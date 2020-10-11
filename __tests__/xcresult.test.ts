import {loadResultBundleNode, parse} from '../src/xcresult'

const TestResultsPath = '__tests__/Test.xcresult'

test('parses a results bundle', async () => {
  const record = await parse(TestResultsPath)
  expect(record).not.toBeNull()
})

test('parses issues', async () => {
  const record = await parse(TestResultsPath)
  expect(record.issues).not.toBeNull()
  if (record.issues) {
    expect(record.issues.warningSummaries).not.toBeNull()
    expect(record.issues.warningSummaries).toHaveLength(2)
  }
})
