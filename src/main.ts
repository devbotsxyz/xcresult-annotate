// MIT License - Copyright (c) 2020 Stefan Arentz <stefan@devbots.xyz>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import * as core from '@actions/core'
import * as github from '@actions/github'
import * as xcresult from './xcresult'

export type AnnotationLevel = 'notice' | 'warning' | 'failure'

async function run(): Promise<void> {
  try {
    const record = await xcresult.parse(core.getInput('result-bundle-path', {required: true}))
    const warnings = record.issues?.warningSummaries
    if (warnings) {
      core.info(`We got ${warnings.length} warnings`)

      const octokit = github.getOctokit(core.getInput('github-token', {required: true}))
      const context = github.context
      const annotations = [] // ChecksUpdateParamsOutput

      for (const warning of warnings) {
        core.info(`${warning.issueType} - ${warning.message}`)

        if (warning.issueType === 'Swift Compiler Warning') {
          const documentLocation = warning.documentLocationInCreatingWorkspace
          if (documentLocation) {
            const url = new URL(documentLocation.url)
            const params = new URLSearchParams(url.href)
            core.info(`Annotating ${url.pathname} at line ${params.get('StartingLineNumber')}`)

            const startingLineNumber = params.get('StartingLineNumber')
            const endingLineNumber = params.get('EndingLineNumber')

            if (startingLineNumber && endingLineNumber) {
              const annotation = {
                annotation_level: 'warning',
                message: warning.message,
                path: 'HelloTests/HelloTests.swift', // TODO Obviously
                start_line: parseInt(startingLineNumber),
                end_line: parseInt(endingLineNumber)
              }
              annotations.push(annotation)
            }
          }
        }
      }

      if (annotations.length) {
        console.log('ANNOTATIONS: ', annotations)

        const response = await octokit.checks.create({
          ...context.repo,
          name: 'Some Check',
          head_sha: context.sha,
          status: 'in_progress'
        })

        const check = response.data

        const xxx: any = annotations // TODO Figure out how to get past that error

        await octokit.checks.update({
          ...context.repo,
          check_run_id: check.id,
          name: check.name,
          status: 'completed',
          conclusion: 'neutral',
          output: {
            title: 'Something something',
            summary: 'This is a summary. Something something. Foo.',
            text: 'This is some _markdown_ that can be `styled` I think?',
            annotations: xxx
          }
        })
      }
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
