import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import multer from 'multer';

const router = Router();

// ---------------------------------------------------------------------------
// Multer — in-memory upload (max 5MB)
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/m4a'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: mp3, wav, m4a`));
    }
  },
});

// ---------------------------------------------------------------------------
// Preset voicemail definitions
// These are the static audio files in /public/audio/
// ---------------------------------------------------------------------------
const PRESETS = [
  { id: 'voicemail_fi', locale: 'fi', name: 'Finnish — Default', filename: 'voicemail_fi.mp3' },
  { id: 'voicemail_en', locale: 'en', name: 'English — Default', filename: 'voicemail_en.mp3' },
  { id: 'voicemail_pt', locale: 'pt', name: 'Portuguese — Default', filename: 'voicemail_pt.mp3' },
];

// ---------------------------------------------------------------------------
// GET /api/voicemail/presets — List available preset voicemail files
// ---------------------------------------------------------------------------
router.get('/voicemail/presets', async (_req: Request, res: Response) => {
  res.json(PRESETS);
});

// ---------------------------------------------------------------------------
// GET /api/voicemail/config — Get current contractor's voicemail config
// ---------------------------------------------------------------------------
router.get('/voicemail/config', async (req: Request, res: Response) => {
  const contractorId = req.contractorId;
  if (!contractorId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const { data: contractor, error } = await supabase
      .from('contractors')
      .select('voicemail_config')
      .eq('id', contractorId)
      .single();

    if (error || !contractor) {
      res.status(404).json({ error: 'Contractor not found' });
      return;
    }

    res.json(contractor.voicemail_config || {});
  } catch (err) {
    console.error('[voicemail] Get config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/voicemail/config — Update voicemail config
// Body: { locale: "fi", type: "preset"|"default", preset_id?: "voicemail_fi_2" }
// ---------------------------------------------------------------------------
router.patch('/voicemail/config', async (req: Request, res: Response) => {
  const contractorId = req.contractorId;
  if (!contractorId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  const { locale, type, preset_id } = req.body as {
    locale?: string;
    type?: 'preset' | 'default' | 'custom';
    preset_id?: string;
  };

  if (!locale || !type) {
    res.status(400).json({ error: 'Missing locale or type' });
    return;
  }

  const validLocales = ['fi', 'en', 'pt'];
  if (!validLocales.includes(locale)) {
    res.status(400).json({ error: 'Invalid locale. Must be: fi, en, pt' });
    return;
  }

  try {
    // Fetch current config
    const { data: contractor } = await supabase
      .from('contractors')
      .select('voicemail_config')
      .eq('id', contractorId)
      .single();

    const config = (contractor?.voicemail_config || {}) as Record<string, unknown>;

    // Build updated entry for this locale
    if (type === 'preset') {
      if (!preset_id) {
        res.status(400).json({ error: 'preset_id required for preset type' });
        return;
      }
      config[locale] = { type: 'preset', preset_id };
    } else if (type === 'default') {
      config[locale] = { type: 'default' };
    } else if (type === 'custom') {
      // Custom type should only be set via upload endpoint
      res.status(400).json({ error: 'Use POST /api/voicemail/upload for custom recordings' });
      return;
    }

    // Save
    const { data: updated, error } = await supabase
      .from('contractors')
      .update({ voicemail_config: config, updated_at: new Date().toISOString() })
      .eq('id', contractorId)
      .select('voicemail_config')
      .single();

    if (error) {
      console.error('[voicemail] Update config error:', error.message);
      res.status(500).json({ error: 'Failed to update config' });
      return;
    }

    res.json(updated.voicemail_config);
  } catch (err) {
    console.error('[voicemail] Update config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/voicemail/upload — Upload a custom voicemail recording
// Multipart form: file (audio), locale (fi|en|pt)
// ---------------------------------------------------------------------------
router.post('/voicemail/upload', upload.single('file'), async (req: Request, res: Response) => {
  const contractorId = req.contractorId;
  if (!contractorId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  const file = req.file;
  const locale = req.body?.locale as string;

  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  if (!locale || !['fi', 'en', 'pt'].includes(locale)) {
    res.status(400).json({ error: 'Invalid or missing locale. Must be: fi, en, pt' });
    return;
  }

  try {
    // Determine file extension from mimetype
    const ext = file.mimetype === 'audio/wav' ? 'wav' : 'mp3';
    const storagePath = `${contractorId}/${locale}.${ext}`;

    // Upload to Supabase Storage (upsert to overwrite existing)
    const { error: uploadError } = await supabase.storage
      .from('voicemails')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error('[voicemail] Upload error:', uploadError.message);
      res.status(500).json({ error: `Upload failed: ${uploadError.message}` });
      return;
    }

    // Update voicemail config
    const { data: contractor } = await supabase
      .from('contractors')
      .select('voicemail_config')
      .eq('id', contractorId)
      .single();

    const config = (contractor?.voicemail_config || {}) as Record<string, unknown>;
    config[locale] = {
      type: 'custom',
      storage_path: `voicemails/${storagePath}`,
    };

    await supabase
      .from('contractors')
      .update({ voicemail_config: config, updated_at: new Date().toISOString() })
      .eq('id', contractorId);

    console.log(`[voicemail] Custom recording uploaded for contractor ${contractorId}, locale ${locale}`);
    res.json({
      success: true,
      locale,
      storage_path: `voicemails/${storagePath}`,
      config: config,
    });
  } catch (err) {
    console.error('[voicemail] Upload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/voicemail/:locale — Delete custom recording, revert to default
// ---------------------------------------------------------------------------
router.delete('/voicemail/:locale', async (req: Request, res: Response) => {
  const contractorId = req.contractorId;
  if (!contractorId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  const { locale } = req.params;
  if (!['fi', 'en', 'pt'].includes(locale)) {
    res.status(400).json({ error: 'Invalid locale' });
    return;
  }

  try {
    // Fetch current config
    const { data: contractor } = await supabase
      .from('contractors')
      .select('voicemail_config')
      .eq('id', contractorId)
      .single();

    const config = (contractor?.voicemail_config || {}) as Record<string, Record<string, string>>;
    const entry = config[locale];

    // If it was a custom recording, delete from storage
    if (entry?.type === 'custom' && entry.storage_path) {
      // storage_path format: "voicemails/{contractorId}/{locale}.mp3"
      const filePath = entry.storage_path.replace('voicemails/', '');
      await supabase.storage.from('voicemails').remove([filePath]);
      console.log(`[voicemail] Deleted custom recording: ${filePath}`);
    }

    // Revert to default
    config[locale] = { type: 'default' } as Record<string, string>;

    await supabase
      .from('contractors')
      .update({ voicemail_config: config, updated_at: new Date().toISOString() })
      .eq('id', contractorId);

    res.json({ success: true, message: `Voicemail for ${locale} reverted to default` });
  } catch (err) {
    console.error('[voicemail] Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
