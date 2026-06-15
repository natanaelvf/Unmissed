// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Finnish (`fi`).
class AppLocalizationsFi extends AppLocalizations {
  AppLocalizationsFi([String locale = 'fi']) : super(locale);

  @override
  String get appName => 'Recovery';

  @override
  String get appNameHighlight => 'AI';

  @override
  String get appTagline => 'Vastaamattomat puhelut palautettu. Liikevaihto palautettu.';

  @override
  String get navDashboard => 'Yhteenveto';

  @override
  String get navLeads => 'Liidit';

  @override
  String get navSettings => 'Asetukset';

  @override
  String get navProfile => 'Profiili';

  @override
  String get navLogout => 'Kirjaudu ulos';

  @override
  String get loginTitle => 'Recovery';

  @override
  String get loginTitleHighlight => 'AI';

  @override
  String get loginSubtitle => 'Urakoitsijan hallintapaneeli';

  @override
  String get loginEmailLabel => 'Sähköposti';

  @override
  String get loginEmailPlaceholder => 'sinä@yritys.fi';

  @override
  String get loginPasswordLabel => 'Salasana';

  @override
  String get loginPasswordPlaceholder => 'Syötä salasanasi';

  @override
  String get loginSubmit => 'Kirjaudu';

  @override
  String get loginForgot => 'Unohditko salasanan?';

  @override
  String get loginGoogleButton => 'Jatka Googlella';

  @override
  String get loginOrDivider => 'tai kirjaudu sähköpostilla';

  @override
  String get loginCreateAccount => 'Ei tiliä? Rekisteröidy';

  @override
  String get loginBackToSignIn => 'Onko sinulla tili? Kirjaudu';

  @override
  String get loginSignUp => 'Luo tili';

  @override
  String get loginPasswordRequirements => 'Vähintään 8 merkkiä, 1 iso kirjain, 1 numero';

  @override
  String get dashboardTitle => 'Yhteenveto';

  @override
  String get dashboardRecoveredRevenue => 'Palautettu liikevaihto';

  @override
  String get dashboardLeadsRecovered => 'Palautetut liidit';

  @override
  String get dashboardRecoveryRate => 'Palautusaste';

  @override
  String get dashboardAvgResponseTime => 'Keskim. vasteaika';

  @override
  String get dashboardRevenueChartTitle => 'Liikevaihto — viimeiset 30 päivää';

  @override
  String get dashboardRecentWins => 'Viimeaikaiset onnistumiset';

  @override
  String get dashboardNoWinsYet => 'Ei vielä valmistuneita liidejä';

  @override
  String get dashboardThisMonth => 'tässä kuussa';

  @override
  String get dashboardTrendUp => 'vs viime kuukausi';

  @override
  String get leadsTitle => 'Liidit';

  @override
  String get leadsSearchPlaceholder => 'Hae nimellä tai puhelinnumerolla...';

  @override
  String get leadsFilterAll => 'Kaikki';

  @override
  String get leadsFilterMissed => 'Vastaamattomat';

  @override
  String get leadsFilterContacted => 'Kontaktoitu';

  @override
  String get leadsFilterBooked => 'Varattu';

  @override
  String get leadsFilterCompleted => 'Valmis';

  @override
  String leadsCalledTimes(int count) {
    return 'Soittanut ${count}x';
  }

  @override
  String get leadsEmptyTitle => 'Ei vielä liidejä';

  @override
  String get leadsEmptyDesc => 'Vastaamattomat puhelut ilmestyvät tänne automaattisesti';

  @override
  String get leadsNoResults => 'Ei hakutuloksia';

  @override
  String get leadDetailBack => 'Takaisin liideihin';

  @override
  String get leadDetailPhone => 'Puhelin';

  @override
  String get leadDetailName => 'Nimi';

  @override
  String get leadDetailStatus => 'Tila';

  @override
  String get leadDetailUrgency => 'Kiireellisyys';

  @override
  String get leadDetailCreated => 'Luotu';

  @override
  String get leadDetailBookingTime => 'Varaus';

  @override
  String get leadDetailEstimatedValue => 'Arv. arvo';

  @override
  String get leadDetailCallCount => 'Soittoja';

  @override
  String get leadDetailSatisfaction => 'Tyytyväisyys';

  @override
  String get leadDetailConversation => 'Keskustelu';

  @override
  String get leadDetailNoMessages => 'Ei viestejä vielä';

  @override
  String get leadDetailMarkComplete => 'Merkitse valmiiksi';

  @override
  String get leadDetailCallLead => 'Soita liidille';

  @override
  String get leadDetailAddNote => 'Lisää muistiinpano';

  @override
  String get leadDetailAfterHours => 'Aukioloajan ulkopuolella';

  @override
  String get leadDetailIssue => 'Ongelma';

  @override
  String get leadDetailFeedback => 'Palaute';

  @override
  String get leadDetailLeadInfo => 'Liidin tiedot';

  @override
  String get leadDetailCosts => 'Kustannukset';

  @override
  String get leadDetailTotalCosts => 'Kustannukset yhteensä';

  @override
  String get leadDetailNetRevenue => 'Nettoliikevaihto';

  @override
  String get leadDetailAddCost => 'Lisää kustannus';

  @override
  String get leadDetailCostDescription => 'Kuvaus';

  @override
  String get leadDetailCostAmount => 'Summa';

  @override
  String get leadDetailNoCosts => 'Ei kustannuksia vielä';

  @override
  String get leadDetailEditValue => 'Muokkaa arvioitua liikevaihtoa';

  @override
  String get settingsTitle => 'Asetukset';

  @override
  String get settingsBusinessInfo => 'Yritystiedot';

  @override
  String get settingsBusinessName => 'Yrityksen nimi';

  @override
  String get settingsContactName => 'Yhteyshenkilö';

  @override
  String get settingsContactEmail => 'Sähköposti';

  @override
  String get settingsContactPhone => 'Puhelin';

  @override
  String get settingsTradeType => 'Toimiala';

  @override
  String get settingsWorkingHours => 'Työajat';

  @override
  String get settingsWorkingDays => 'Työpäivät';

  @override
  String get settingsStartTime => 'Alkamisaika';

  @override
  String get settingsEndTime => 'Päättymisaika';

  @override
  String get settingsRecovery => 'Palautusasetukset';

  @override
  String get settingsUrgentThreshold => 'Kiireellinen kynnys (min)';

  @override
  String get settingsNormalThreshold => 'Normaali kynnys (min)';

  @override
  String get settingsDefaultJobValue => 'Oletustyön arvo (€)';

  @override
  String get settingsCalendlyUrl => 'Calendly-linkki';

  @override
  String get settingsAccount => 'Tili';

  @override
  String get settingsTier => 'Tilaustyyppi';

  @override
  String get settingsSmsUsage => 'SMS-käyttö';

  @override
  String settingsSmsUsedOf(int used, int cap) {
    return '$used / $cap käytetty';
  }

  @override
  String get settingsSave => 'Tallenna muutokset';

  @override
  String get profileTitle => 'Profiili';

  @override
  String get profileLanguage => 'Kieli';

  @override
  String get profileVersion => 'Sovellusversio';

  @override
  String get profileLogout => 'Kirjaudu ulos';

  @override
  String get profileLogoutConfirm => 'Haluatko varmasti kirjautua ulos?';

  @override
  String get urgencyEmergency => 'Hätätapaus';

  @override
  String get urgencyHigh => 'Kiireellinen';

  @override
  String get urgencyMedium => 'Tällä viikolla';

  @override
  String get urgencyLow => 'Ei kiire';

  @override
  String get urgencyUnknown => 'Tuntematon';

  @override
  String get statusMissed => 'Vastaamaton';

  @override
  String get statusConsentSent => 'Suostumus lähetetty';

  @override
  String get statusOptedIn => 'Hyväksytty';

  @override
  String get statusQualifying => 'Kartoitetaan';

  @override
  String get statusBookingSent => 'Varauslinkki lähetetty';

  @override
  String get statusBooked => 'Varattu';

  @override
  String get statusCompleted => 'Valmis';

  @override
  String get statusFollowedUp => 'Seurattu';

  @override
  String get statusDnrAlert => 'DNR-hälytys';

  @override
  String get statusNoConsent => 'Ei suostumusta';

  @override
  String get statusContacted => 'Kontaktoitu';

  @override
  String get dayMon => 'Ma';

  @override
  String get dayTue => 'Ti';

  @override
  String get dayWed => 'Ke';

  @override
  String get dayThu => 'To';

  @override
  String get dayFri => 'Pe';

  @override
  String get daySat => 'La';

  @override
  String get daySun => 'Su';

  @override
  String get toastLeadCompleted => 'Liidi merkitty valmiiksi!';

  @override
  String get toastSettingsSaved => 'Asetukset tallennettu';

  @override
  String toastNewLead(String phone) {
    return 'Uusi vastaamaton puhelu: $phone';
  }

  @override
  String get toastCostAdded => 'Kustannus lisätty';

  @override
  String get toastValueUpdated => 'Liikevaihto päivitetty';

  @override
  String get timeJustNow => 'Juuri nyt';

  @override
  String timeMinutesAgo(int count) {
    return '$count min sitten';
  }

  @override
  String timeHoursAgo(int count) {
    return '$count t sitten';
  }

  @override
  String timeDaysAgo(int count) {
    return '$count pv sitten';
  }

  @override
  String timeWeeksAgo(int count) {
    return '$count vk sitten';
  }

  @override
  String get waitingForResponse => 'Odotetaan vastausta...';

  @override
  String get settingsNotifications => 'Ilmoitukset';

  @override
  String get settingsNotifMissedCall => 'Vastaamattomat puhelut';

  @override
  String get settingsNotifMissedCallDesc => 'Ilmoitus kun puhelu jää vastaamatta';

  @override
  String get settingsNotifBooking => 'Varausvahvistukset';

  @override
  String get settingsNotifBookingDesc => 'Ilmoitus kun liidi varaa takaisinsoiton';

  @override
  String get settingsNotifStatusChange => 'Liidin tilamuutokset';

  @override
  String get settingsNotifStatusChangeDesc => 'Ilmoitus kun liidin tila muuttuu';

  @override
  String get settingsNotifSystemAlert => 'Järjestelmähälytykset';

  @override
  String get settingsNotifSystemAlertDesc => 'Kriittiset järjestelmäilmoitukset (aina päällä)';

  @override
  String get settingsNotifPayment => 'Maksuisuilmoitukset';

  @override
  String get settingsNotifPaymentDesc => 'Ilmoitus maksupäivityksistä';

  @override
  String get voicemailTitle => 'Vastaajaviestit';

  @override
  String get voicemailSubtitle => 'Muokkaa tervehdystä, jonka soittajat kuulevat kun et voi vastata';

  @override
  String get voicemailTypeDefault => 'Oletus (tekoääni)';

  @override
  String get voicemailTypePreset => 'Valmis';

  @override
  String get voicemailTypeCustom => 'Oma äänitys';

  @override
  String get voicemailRecord => 'Äänitä';

  @override
  String get voicemailUpload => 'Lataa';

  @override
  String get voicemailDelete => 'Poista äänitys';

  @override
  String get voicemailDeleteConfirm => 'Oletko varma? Tämä palauttaa oletustervehdyksen.';

  @override
  String get voicemailRecording => 'Äänitetään...';

  @override
  String get voicemailRecordingStop => 'Lopeta';

  @override
  String get voicemailPlay => 'Esikuuntele';

  @override
  String get voicemailPlaying => 'Soitetaan...';

  @override
  String get voicemailSaved => 'Vastaajatervehdys päivitetty!';

  @override
  String get voicemailUploadSuccess => 'Äänitys ladattu onnistuneesti';

  @override
  String get voicemailLocaleFi => 'Suomi';

  @override
  String get voicemailLocaleEn => 'Englanti';

  @override
  String get voicemailLocalePt => 'Portugali';
}
