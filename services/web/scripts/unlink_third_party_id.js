const { waitForDb } = require('../app/src/infrastructure/mongodb')
const minimist = require('minimist')
const ThirdPartyIdentityManager = require('../app/src/Features/User/ThirdPartyIdentityManager')
const UserGetter = require('../app/src/Features/User/UserGetter')

/**
 * This script is used to remove a linked third party identity from a user account.
 *
 * Parameters:
 *  --providerId: the third party identity provider (e.g. google, collabratec)
 *  --userId: the id of the user
 *  --commit: if present, the script will commit the changes to the database.
 *
 * Usage:
 *
 *   - dry run:
 *     node scripts/unlink_third_party_id.js --providerId=google --userId=${SOME_USER_ID}
 *   - commit:
 *     node scripts/unlink_third_party_id.js --providerId=google --userId=${SOME_USER_ID} --commit
 */

let COMMIT = false
let PROVIDER_ID
let USER_ID

const setup = () => {
  const argv = minimist(process.argv.slice(2))
  COMMIT = argv.commit !== undefined
  PROVIDER_ID = argv.providerId
  USER_ID = argv.userId
  if (!COMMIT) {
    console.warn('Doing dry run. Add --commit to commit changes')
  }
}

async function main() {
  if (!PROVIDER_ID) {
    throw new Error('No --providerId argument provided')
  }

  if (!USER_ID) {
    throw new Error('No --userId argument provided')
  }

  await waitForDb()

  const auditLog = {
    initiatorId: undefined,
    ipAddress: '0.0.0.0',
    extraInfo: {
      script: true,
    },
  }

  const user = await UserGetter.promises.getUser(USER_ID, {
    thirdPartyIdentifiers: 1,
  })

  console.log(
    `Existing thirdPartyIdentifiers: ${JSON.stringify(
      user.thirdPartyIdentifiers
    )}`
  )

  console.log(`Removing third party identifier for provider: ${PROVIDER_ID}`)

  if (COMMIT) {
    const updatedUser = await ThirdPartyIdentityManager.promises.unlink(
      USER_ID,
      PROVIDER_ID,
      auditLog
    )

    console.log(
      `Remaining thirdPartyIdentifiers: ${JSON.stringify(
        updatedUser.thirdPartyIdentifiers
      )}`
    )
  }
}

setup()

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
