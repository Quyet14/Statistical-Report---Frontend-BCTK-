const { test } = require("node:test");
const assert = require("node:assert/strict");
const { tsLoader } = require("./helpers/ts-loader.cjs");
test("employee import template is a plain xlsx with column headers in the first row", () => {
  const { reportWorkbook } = tsLoader({ TextEncoder })("src/lib/report-xlsx.ts");
  const bytes = reportWorkbook(
    [["Họ tên", "Email", "Mã nhân viên", "Vai trò", "Khoa/phòng", "Chi nhánh"]],
    { title: "", period: "", author: "", layout: "table", sheetName: "Nhân sự" },
  );
  const buffer = Buffer.from(bytes);
  let offset = 0;
  const files = new Map();
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extra = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extra;
    files.set(name, buffer.subarray(start, start + size).toString("utf8"));
    offset = start + size;
  }
  const sheet = files.get("xl/worksheets/sheet1.xml");
  assert.match(sheet, /<row r="1"/);
  assert.match(sheet, /<c r="A1"[^>]*>.*Họ tên/);
  assert.doesNotMatch(sheet, /<row r="2"/);
  assert.doesNotMatch(sheet, /mergeCells/);
});
test("started work at zero percent remains started after server normalization", () => {
  const { persistedTaskState } = tsLoader()("src/lib/task-state.ts");
  assert.deepEqual({...persistedTaskState({status: "doing", progress: 0})}, {status: "doing", progress: 0});
  assert.deepEqual({...persistedTaskState({progress: 0})}, {status: "todo", progress: 0});
});

test("submitted work at 100 percent never becomes completed until approved", () => {
  const { persistedTaskState } = tsLoader()("src/lib/task-state.ts");
  assert.deepEqual(
    {
      ...persistedTaskState({
        status: "doing",
        progress: 100,
        reviewerId: 2,
        approvalState: "submitted",
      }),
    },
    { status: "doing", progress: 100 },
  );
  assert.deepEqual(
    {
      ...persistedTaskState({
        status: "done",
        progress: 100,
        reviewerId: 2,
        approvalState: "approved",
      }),
    },
    { status: "done", progress: 100 },
  );
});
test("xlsx is a real ZIP workbook with escaped text and no executable cell formulas", () => {
  const { reportWorkbook } = tsLoader({ TextEncoder })(
    "src/lib/report-xlsx.ts",
  );
  const bytes = reportWorkbook(
    [
      ["Nội dung", "Điểm"],
      ['=HYPERLINK("bad") <script>', 100],
    ],
    { title: "Báo cáo", period: "2026-10", author: "Quản trị" },
  );
  const buffer = Buffer.from(bytes);
  assert.equal(buffer.readUInt32LE(0), 0x04034b50);
  let offset = 0;
  const files = new Map();
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18),
      nameLength = buffer.readUInt16LE(offset + 26),
      extra = buffer.readUInt16LE(offset + 28);
    const name = buffer
      .subarray(offset + 30, offset + 30 + nameLength)
      .toString("utf8");
    const start = offset + 30 + nameLength + extra;
    files.set(name, buffer.subarray(start, start + size).toString("utf8"));
    offset = start + size;
  }
  assert.ok(files.has("[Content_Types].xml"));
  assert.ok(files.has("xl/workbook.xml"));
  const sheet = files.get("xl/worksheets/sheet1.xml");
  assert.match(sheet, /&lt;script&gt;/);
  assert.doesNotMatch(sheet, /<f[ >]/);
  assert.match(sheet, /t="inlineStr"/);
  assert.equal(buffer.readUInt32LE(buffer.length - 22), 0x06054b50);
});
