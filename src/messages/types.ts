/** Shape of the guest-facing message catalog. Implemented by ru.ts and en.ts. */
export interface GuestMessages {
  // Welcome & house selection
  welcome(houseName: string): string;
  menuPrompt: string;
  chooseHouse: string;
  scanOrChooseHouse: string;
  houseConfirm(houseName: string): string;
  houseSwitched(houseName: string): string;
  houseKept(houseName: string): string;
  unknownHouse: string;
  pastStayQuestion: string;

  // Confirmations & reassurance
  requestReceived: string;
  adminHandling: string;
  needDetails: string;
  done: string;
  unclear: string;
  emergency(phone: string): string;
  photoReceived: string;
  voiceReceived: string;
  fileReceived: string;
  waitingReassure: string;

  // Category prompts
  writeQuestion: string;
  addCommentPrompt: string;
  drovaQuestion: string;
  linenQuestion: string;
  cleaningQuestion: string;
  brokenQuestion: string;
  banyaQuestion: string;
  taxiQuestion: string;
  wifiInfo(name: string, password: string): string;
  wifiMissing: string;
  checkinoutInfo: string;
  mapInfo: string;

  // Errors & fallback
  dbError(phone: string): string;
  genericError(phone: string): string;

  // Commands
  help(phone: string): string;
  callInfo(phone: string): string;
  languageChoose: string;
  languageSet: string;

  // Guest button labels
  btnBack: string;
  btnYesDrova: string;
  btnAddComment: string;
  btnConfirmHouse: string;
  btnChangeHouse: string;
  btnPastStay: string;
  btnNewBooking: string;
  btnTowels: string;
  btnBedLinen: string;
  btnPaper: string;
  btnOther: string;
  btnCleaning: string;
  btnTakeTrash: string;
  btnUrgentCleaning: string;
  btnLight: string;
  btnWater: string;
  btnHeating: string;
  btnDoorLock: string;
  btnWifi: string;
  btnBanya: string;
  btnGrill: string;
  btnTub: string;
}
