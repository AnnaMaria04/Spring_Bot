/** Shape of the guest-facing message catalog. Implemented by ru.ts and en.ts. */
export interface GuestMessages {
  // Welcome & house
  welcome(houseName: string): string;
  menuPrompt: string;
  servicesTitle: string;
  infoTitle: string;
  inputPlaceholder: string;
  housePlaceholder: string;
  askHouseNumber: string;
  chooseHouseTitle: string;
  houseNotFound: string;
  houseConfirm(houseName: string): string;
  scanOrChooseHouse: string;

  // Confirmations & reassurance
  requestReceived: string;
  done: string;
  unclear: string;
  emergency(phone: string): string;
  photoReceived: string;
  voiceReceived: string;
  fileReceived: string;
  writeQuestion: string;
  addCommentPrompt: string;

  // Service prompts
  drovaQuestion: string;
  linenQuestion: string;
  cleaningQuestion: string;
  gearQuestion: string;
  bbqQuestion: string;
  brokenQuestion: string;

  // Info auto-answers
  wifiInfo(name: string, password: string): string;
  wifiMissing: string;
  activitiesInfo: string;
  checkoutInfo: string;
  rulesInfo: string;
  addressInfo(address: string, coords: string): string;

  // Errors & fallback
  dbError(phone: string): string;
  genericError(phone: string): string;

  // Commands
  help(phone: string): string;
  callInfo(phone: string): string;
  languageChoose: string;
  languageSet: string;

  // Guest button labels
  btnServices: string;
  btnInfo: string;
  btnBack: string;
  btnConfirmHouse: string;
  btnChangeHouse: string;
  btnAddComment: string;
  btnYesDrova: string;
  btnTowels: string;
  btnBedLinen: string;
  btnPaper: string;
  btnOther: string;
  btnCleaning: string;
  btnTakeTrash: string;
  btnBoat: string;
  btnSup: string;
  btnBikes: string;
  btnGrill: string;
  btnSkewers: string;
  btnLight: string;
  btnWater: string;
  btnHeating: string;
  btnDoorLock: string;
  btnWifi: string;
}
