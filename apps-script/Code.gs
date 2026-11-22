/**
 * attack_log — receiver + workbook builder
 *
 * Paste this into Extensions > Apps Script on the attack_log spreadsheet.
 * 1. Change TOKEN below to anything long and random.
 * 2. Run setup() once (it builds the three sheets).
 * 3. Deploy > New deployment > Web app
 *      Execute as:  Me
 *      Who has access:  Anyone
 *    Copy the /exec URL — that plus the token go into the app.
 *
 * The Log sheet is append-only and holds nothing but posted facts.
 * Attacks and Summary are derived with formulas, so they stay correct
 * even if you edit the Log by hand. Nothing computes on the Log sheet
 * itself, because an ARRAYFORMULA there would make appendRow write
 * past the bottom of the data.
 */

var TOKEN = 'CHANGE-ME-to-something-long-and-random';

var LOG_HEADERS = [
  'Timestamp','Date','Time','Event','Attack ID','Started','Ended',
  'Type','Side','Aura','Throbbing','One-sided','Nausea','Light/Sound',
  'Stopped activity','Worse on movement','Watery eye','Blocked nose',
  'Autonomic side','Signs','Drug','Drug class','Systolic','Diastolic',
  'Pulse','Dizzy on standing','Note','Source'
];

/* ---------------------------------------------------------------- receive */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.token !== TOKEN) return reply({ ok: false, error: 'bad token' });

    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Log');
    if (!sh) return reply({ ok: false, error: 'no Log sheet — run setup() first' });

    // The app asks for everything back on start-up, so the Sheet stays the
    // source of truth and any device shows the same history.
    if (body.action === 'read') {
      var last = sh.getLastRow();
      if (last < 2) return reply({ ok: true, rows: [] });
      return reply({ ok: true, rows: sh.getRange(2, 1, last - 1, LOG_HEADERS.length).getValues() });
    }

    var events = body.events || [];
    if (!events.length) return reply({ ok: true, written: 0 });

    var rows = events.map(toRow);
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, LOG_HEADERS.length).setValues(rows);

    return reply({ ok: true, written: rows.length, ids: events.map(function (v) { return v.eventId; }) });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

/* A browser GET is a quick way to check the deployment is live. */
function doGet() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Log');
  return reply({ ok: true, rows: sh ? Math.max(0, sh.getLastRow() - 1) : 0 });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function d(v) { return v ? new Date(v) : ''; }
function yn(v) { return v === true ? 'Y' : v === false ? 'N' : (v || ''); }

function toRow(v) {
  var at = new Date(v.at);
  return [
    at,
    Utilities.formatDate(at, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    Utilities.formatDate(at, Session.getScriptTimeZone(), 'HH:mm'),
    v.event || '',
    v.attackId || '',
    d(v.started),
    d(v.ended),
    v.type || '',
    v.side || '',
    yn(v.aura),
    yn(v.throbbing),
    yn(v.oneSided),
    yn(v.nausea),
    yn(v.lightSound),
    yn(v.stopped),
    yn(v.worseMove),
    yn(v.eye),
    yn(v.nose),
    v.autonomicSide || '',
    v.signs || '',
    v.drug || '',
    v.drugClass || '',
    v.sys || '',
    v.dia || '',
    v.pulse || '',
    yn(v.orthostatic),
    v.note || '',
    v.source || 'app'
  ];
}

/* ------------------------------------------------------------------ build */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  buildLog(ss);
  buildAttacks(ss);
  buildSummary(ss);
  var first = ss.getSheets()[0];
  if (first.getName() === 'Sheet1' && first.getLastRow() === 0) ss.deleteSheet(first);
  // Never call SpreadsheetApp.getUi() here: run from the script editor it opens a
  // dialog in the spreadsheet tab and blocks until someone clicks it, which just
  // burns the six-minute execution limit.
  Logger.log('Set up. Now deploy as a web app.');
}

function sheet(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  return sh;
}

function buildLog(ss) {
  var sh = sheet(ss, 'Log');
  sh.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS])
    .setFontWeight('bold').setBackground('#1d1915').setFontColor('#ece2d4');
  sh.setFrozenRows(1);
  sh.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
  sh.getRange('F:G').setNumberFormat('yyyy-mm-dd hh:mm');
  sh.setColumnWidth(1, 140);
  sh.setColumnWidth(27, 320);
  sh.getRange('A2').setNote(
    'Append-only. One row per thing that happened. Never sort this sheet — ' +
    'Attacks and Summary read it by position-independent formulas, but new ' +
    'rows must land at the bottom for the app to keep working.');
}

function buildAttacks(ss) {
  var sh = sheet(ss, 'Attacks');
  sh.getRange('A1:S1').setValues([[
    'Started','Ended','Type','Side','Aura','Throbbing','One-sided','Nausea',
    'Light/Sound','Stopped','Worse on movement','Watery eye','Blocked nose',
    'Autonomic side','Note','Hours','ID Migraine','POUND','Verdict'
  ]]).setFontWeight('bold').setBackground('#1d1915').setFontColor('#ece2d4');
  sh.setFrozenRows(1);

  // One row per closed attack, oldest first. Re-scoring an attack appends a
  // second "attack end" row for the same Attack ID — the log keeps both as the
  // audit trail, and the COUNTIFS here keeps only the latest one per ID.
  sh.getRange('A2').setFormula(
    '=IFERROR(SORT(FILTER({Log!F2:S,Log!AA2:AA},' +
    'Log!D2:D="attack end",' +
    'COUNTIFS(Log!E2:E,Log!E2:E,Log!D2:D,"attack end",Log!A2:A,">"&Log!A2:A)=0' +
    '),1,TRUE),)');
  sh.getRange('U3').setValue(
    'If an amended attack ever shows twice, the de-duplicating COUNTIFS in A2 is ' +
    'the part to look at. The simpler fallback is: ' +
    '=QUERY(Log!A2:AB,"select F,G,H,I,J,K,L,M,N,O,P,Q,R,S,AA where D = \'attack end\' order by F",0)');

  sh.getRange('P2').setFormula('=ARRAYFORMULA(IF(A2:A="","",ROUND((B2:B-A2:A)*24,1)))');
  sh.getRange('Q2').setFormula('=ARRAYFORMULA(IF(A2:A="","",(H2:H="Y")+(I2:I="Y")+(J2:J="Y")))');
  sh.getRange('R2').setFormula(
    '=ARRAYFORMULA(IF(A2:A="","",(F2:F="Y")+((P2:P>=4)*(P2:P<=72))+(G2:G="Y")+(H2:H="Y")+(J2:J="Y")))');
  sh.getRange('S2').setFormula(
    '=ARRAYFORMULA(IF(A2:A="","",IF(E2:E="Y","Migraine likely",' +
    'IF((Q2:Q>=2)+(R2:R>=4),"Migraine likely",' +
    'IF((Q2:Q=0)*(R2:R<=1)*(K2:K<>"Y"),"Tension-type likely","Unclear")))))');

  sh.getRange('A:B').setNumberFormat('yyyy-mm-dd hh:mm');
  sh.setColumnWidth(15, 320);
  sh.getRange('U1').setValue('Aura with head pain returns Migraine likely on its own: neither ID Migraine nor POUND asks about aura.');
  sh.getRange('U2').setValue('Hours comes from the start and end you logged, so it feeds the 4-72h POUND point automatically.');
}

function buildSummary(ss) {
  var sh = sheet(ss, 'Summary');
  var L = 'Log!$A$2:$AB';
  var day = 'INT(Log!$A$2:$A)';
  var win = 'Log!$A$2:$A>=TODAY()-30';

  // ROWS(), not COUNTA(): an empty FILTER returns #N/A, and COUNTA counts that
  // error as one cell, so the IFERROR never fires and every count reads 1.
  function medDays(cls) {
    return '=IFERROR(ROWS(UNIQUE(FILTER(' + day + ',Log!$D$2:$D="dose",' + win +
      (cls ? ',Log!$V$2:$V="' + cls + '"' : '') + '))),0)';
  }

  var rows = [
    ['attack_log — summary', ''],
    ['', ''],
    ['Last 30 days', ''],
    ['Attack days', '=IFERROR(ROWS(UNIQUE(FILTER(' + day + ',Log!$D$2:$D="attack start",' + win + '))),0)'],
    ['Days on any acute med', medDays('')],
    ['Triptan days (limit 10)', medDays('triptan')],
    ['Combination analgesic days (limit 10)', medDays('combo')],
    ['Simple analgesic days (limit 15)', medDays('simple')],
    ['', ''],
    ['Warning signs', ''],
    ['Logged in last 30 days', '=IFERROR(COUNTIF(FILTER(Log!$D$2:$D,' + win + '),"signal"),0)'],
    ['Followed by an attack within 24h',
      '=IFERROR(SUMPRODUCT((FILTER(Log!$D$2:$D,' + win + ')="signal")*' +
      '(COUNTIFS(Log!$D$2:$D,"attack start",Log!$A$2:$A,">"&FILTER(Log!$A$2:$A,' + win + '),' +
      'Log!$A$2:$A,"<="&FILTER(Log!$A$2:$A,' + win + ')+1)>0)),0)'],
    ['', ''],
    ['All time', ''],
    ['Attacks closed', '=IFERROR(COUNTA(Attacks!A2:A),0)'],
    ['Migraine likely', '=COUNTIF(Attacks!S:S,"Migraine likely")'],
    ['Tension-type likely', '=COUNTIF(Attacks!S:S,"Tension-type likely")'],
    ['Unclear', '=COUNTIF(Attacks!S:S,"Unclear")'],
    ['Median attack hours', '=IFERROR(ROUND(MEDIAN(Attacks!P2:P),1),"")'],
    ['Events logged', '=MAX(0,COUNTA(Log!A2:A))'],
    ['First event', '=IF(COUNT(Log!A2:A)=0,"",TEXT(MIN(Log!A2:A),"d mmm yyyy"))']
  ];

  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange('A1').setFontSize(14).setFontWeight('bold');
  ['A3', 'A10', 'A14'].forEach(function (a) {
    sh.getRange(a).setFontWeight('bold').setBackground('#f3ece1');
  });
  sh.setColumnWidth(1, 300);
  sh.setColumnWidth(2, 120);
  sh.getRange('B4:B8').setHorizontalAlignment('left');
  sh.getRange('D3').setValue(
    'Thresholds are a prompt to talk to a GP, not a rule to self-manage against. ' +
    'The classes are not independent — the combined any-acute-med count is the one that matters most.');
}
