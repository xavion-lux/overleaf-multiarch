/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const UrlFetcher = require('./UrlFetcher')
const Settings = require('@overleaf/settings')
const fs = require('fs')
const Path = require('path')
const { callbackify } = require('util')
const Metrics = require('./Metrics')

const PENDING_DOWNLOADS = new Map()

function getProjectDir(projectId) {
  return Path.join(Settings.path.clsiCacheDir, projectId)
}

function getCachePath(projectId, url, lastModified) {
  // The url is a filestore URL.
  // It is sufficient to look at the path and mtime for uniqueness.
  const mtime = (lastModified && lastModified.getTime()) || 0
  const key = new URL(url).pathname.replace(/\//g, '-') + '-' + mtime
  return Path.join(getProjectDir(projectId), key)
}

async function clearProject(projectId, options) {
  const timer = new Metrics.Timer('url_cache', {
    status: options?.reason || 'unknown',
    path: 'delete',
  })
  await fs.promises.rm(getProjectDir(projectId), {
    force: true,
    recursive: true,
  })
  timer.done()
}

async function createProjectDir(projectId) {
  await fs.promises.mkdir(getProjectDir(projectId), { recursive: true })
}

async function downloadUrlToFile(projectId, url, destPath, lastModified) {
  const cachePath = getCachePath(projectId, url, lastModified)
  try {
    const timer = new Metrics.Timer('url_cache', {
      status: 'cache-hit',
      path: 'copy',
    })
    await fs.promises.copyFile(cachePath, destPath)
    // the metric is only updated if the file is present in the cache
    timer.done()
    return
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e
    }
  }
  // time the download
  {
    const timer = new Metrics.Timer('url_cache', {
      status: 'cache-miss',
      path: 'download',
    })
    try {
      await download(url, cachePath)
    } finally {
      timer.done()
    }
  }
  // time the file copy
  {
    const timer = new Metrics.Timer('url_cache', {
      status: 'cache-miss',
      path: 'copy',
    })
    await fs.promises.copyFile(cachePath, destPath)
    timer.done()
  }
}

async function download(url, cachePath) {
  let pending = PENDING_DOWNLOADS.get(cachePath)
  if (pending) {
    return pending
  }

  pending = UrlFetcher.promises.pipeUrlToFileWithRetry(url, cachePath)
  PENDING_DOWNLOADS.set(cachePath, pending)
  try {
    await pending
  } finally {
    PENDING_DOWNLOADS.delete(cachePath)
  }
}

module.exports = {
  clearProject: callbackify(clearProject),
  createProjectDir: callbackify(createProjectDir),
  downloadUrlToFile: callbackify(downloadUrlToFile),
  promises: {
    clearProject,
    createProjectDir,
    downloadUrlToFile,
  },
}
