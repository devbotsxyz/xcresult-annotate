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

import * as path from 'path'

import * as plist from 'simple-plist'
import execa from 'execa'

const SupportedStorageBackend = 'fileBacked2'
const SupportedStorageCompression = 'standard'
const SupportedMajorVersion = 3

function getInt(root: any, name: string): number {
  if (root[name]['_type']['_name'] !== 'Int') {
    throw Error(`Cannot get ${name}; expected type Int but got ${root[name]['_type']}`)
  }
  return parseInt(root[name]['_value'])
}

function getString(root: any, name: string): string {
  if (root[name]['_type']['_name'] !== 'String') {
    throw Error(`Cannot get ${name}; expected type String but got ${root[name]['_type']}`)
  }
  return root[name]['_value']
}

function getDate(root: any, name: string): Date {
  if (root[name]['_type']['_name'] !== 'Date') {
    throw Error(`Cannot get ${name}; expected type Date but got ${root[name]['_type']}`)
  }
  return new Date(root[name]['_value'])
}

function getArray(root: any, name: string): any[] {
  if (root[name]['_type']['_name'] !== 'Array') {
    throw Error(`Cannot get ${name}; expected type Array but got ${root[name]['_type']}`)
  }
  return root[name]['_values']
}

export class ResultMetrics {
  testsCount?: number
  warningCount?: number

  constructor(json: any) {
    if (json['testsCount']) {
      this.testsCount = getInt(json, 'testsCount')
    }
    if (json['warningCount']) {
      this.warningCount = getInt(json, 'warningCount')
    }
  }
}

export class ActionRecord {
  startedTime: Date
  endedTime: Date
  title: string
  schemeCommandName: string
  schemeTaskName: string

  constructor(json: any) {
    this.startedTime = getDate(json, 'startedTime')
    this.endedTime = getDate(json, 'endedTime')
    this.title = getString(json, 'title')
    this.schemeCommandName = getString(json, 'schemeCommandName')
    this.schemeTaskName = getString(json, 'schemeTaskName')
  }
}

export class DocumentLocation {
  concreteTypeName: string
  url: string

  constructor(json: any) {
    this.concreteTypeName = getString(json, 'concreteTypeName')
    this.url = getString(json, 'url')
  }
}

export class IssueSummary {
  issueType: string
  message: string
  documentLocationInCreatingWorkspace?: DocumentLocation

  constructor(json: any) {
    this.issueType = getString(json, 'issueType')
    this.message = getString(json, 'message')

    if (json['documentLocationInCreatingWorkspace']) {
      this.documentLocationInCreatingWorkspace = new DocumentLocation(json['documentLocationInCreatingWorkspace'])
    }
  }
}

export class ResultIssueSummaries {
  warningSummaries?: IssueSummary[]

  constructor(json: any) {
    if (json['warningSummaries']) {
      this.warningSummaries = []
      for (const item of getArray(json, 'warningSummaries')) {
        if (item['_type']['_name'] === 'IssueSummary') {
          this.warningSummaries.push(new IssueSummary(item))
        }
      }
    }
  }
}

export class ActionsInvocationRecord {
  actions?: ActionRecord[]
  issues?: ResultIssueSummaries
  metrics?: ResultMetrics

  constructor(json: any) {
    if (json['actions']) {
      this.actions = []
      for (const action of getArray(json, 'actions')) {
        if (action['_type']['_name'] === 'ActionRecord') {
          this.actions.push(new ActionRecord(action))
        }
      }
    }

    if (json['issues']) {
      this.issues = new ResultIssueSummaries(json['issues'])
    }

    if (json['metrics']) {
      this.metrics = new ResultMetrics(json['metrics'])
    }
  }
}

export async function loadResultBundleNode(resultBundlePath: string, id: string): Promise<any> {
  const xcodebuild = execa('xcrun', ['xcresulttool', 'get', '--format', 'json', '--path', resultBundlePath, '--id', id])
  const {stdout} = await xcodebuild
  return JSON.parse(stdout)
}

export async function parse(resultBundlePath: string): Promise<ActionsInvocationRecord> {
  const info = plist.readFileSync(path.join(resultBundlePath, '/Info.plist'))

  if (info['storage']['backend'] !== SupportedStorageBackend) {
    throw Error(`Cannot parse results bundle: unsupported storage backend ${info['storage']['backend']}`)
  }

  if (info['storage']['compression'] !== SupportedStorageCompression) {
    throw Error(`Cannot parse results bundle: unsupported storage compression ${info['storage']['backend']}`)
  }

  if (info['version']['major'] !== SupportedMajorVersion) {
    throw Error(`Cannot parse results bundle: unsupported major version ${info['version']['major']}`)
  }

  const root = await loadResultBundleNode(resultBundlePath, info['rootId']['hash'])
  if (root['_type']['_name'] !== 'ActionsInvocationRecord') {
    throw Error(`Cannot parse results bundle: unexpected root type ${root['_type']['_name']}`)
  }

  return new ActionsInvocationRecord(root)
}
