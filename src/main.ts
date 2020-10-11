import * as core from '@actions/core'
import * as github from '@actions/github'
import * as xcresult from './xcresult'

async function run(): Promise<void> {
  try {
    const record = await xcresult.parse(core.getInput('result-bundle-path', {required: true}))
    const warnings = record.issues?.warningSummaries
    if (warnings) {
      core.info(`We got ${warnings.length} warnings`)
      for (const warning of warnings) {
        core.info(`${warning.issueType} - ${warning.message}`)

        if (warning.issueType === 'Swift Compiler Warning') {
          const documentLocation = warning.documentLocationInCreatingWorkspace
          if (documentLocation) {
            const url = new URL(documentLocation.url)
            const params = new URLSearchParams(url.href)
            core.info(`Annotating ${url.pathname} at line ${params.get('StartingLineNumber')}`)

            const octokit = github.getOctokit(core.getInput('github-token', {required: true}))

            const lineNumber = params.get('StartingLineNumber')
            if (lineNumber) {
              const context = github.context

              const response = await octokit.checks.create({
                ...context.repo,
                name: 'Some Check',
                head_sha: context.sha,
                status: 'in_progress'
              })

              const annotations = [
                {
                  annotation_level: 'warning',
                  message: warning.message,
                  path: 'HelloTests/HelloTests.swift', // TODO Obviously
                  start_line: lineNumber,
                  end_line: lineNumber
                }
              ]

              const check = response.data

              await octokit.checks.update({
                ...context.repo,
                check_run_id: check.id,
                name: check.name,
                status: 'completed',
                conclusion: 'failure',
                output: {
                  title: 'Something something',
                  summary: 'This is a summary. Something something. Foo.',
                  text: 'This is some _markdown_ that can be `styled` I think?'
                },
                annotation: annotations
              })
            }
          }
        }
      }
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
