const Metrics = require('@overleaf/metrics')
const SplitTestManager = require('./SplitTestManager')
const { CacheLoader } = require('cache-flow')

class SplitTestCache extends CacheLoader {
  constructor() {
    super('split-test', {
      expirationTime: 60, // 1min in seconds
    })
  }

  async load() {
    Metrics.inc('split_test_get_split_test_from_mongo', 1, {})
    const splitTests = await SplitTestManager.getRuntimeTests()
    return new Map(splitTests.map(splitTest => [splitTest.name, splitTest]))
  }

  serialize(value) {
    return value
  }

  deserialize(value) {
    return value
  }
}

module.exports = new SplitTestCache()
