export const ESC = '\u001b';

// Shared hostile terminal payload for the ANSI stripping and clipboard tests.
export const HOSTILE_ANSI =
  `${ESC}]8;;https://evil.example/${ESC}\\link${ESC}]8;;${ESC}\\` +
  `${ESC}]52;c;cHduZWQ=\u0007clip` +
  `${ESC}Pdcs payload${ESC}\\` +
  `${ESC}_apc payload${ESC}\\` +
  `${ESC}(Btwo-byte` +
  `\u009d52;c;c1-osc\u0007c1clip` +
  `\u0090c1-dcs\u009c` +
  `\u009b1mc1-csi\u009b0m` +
  `\u0000\u0007\u007f\u0085\u009f`;

export const VISIBLE_ANSI = 'linkcliptwo-bytec1clipc1-csi';
