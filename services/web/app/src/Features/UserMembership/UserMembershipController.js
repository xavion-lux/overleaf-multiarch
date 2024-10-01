const SessionManager = require('../Authentication/SessionManager')
const UserMembershipHandler = require('./UserMembershipHandler')
const Errors = require('../Errors/Errors')
const EmailHelper = require('../Helpers/EmailHelper')
const { csvAttachment } = require('../../infrastructure/Response')
const {
  UserIsManagerError,
  UserAlreadyAddedError,
  UserNotFoundError,
} = require('./UserMembershipErrors')
const { SSOConfig } = require('../../models/SSOConfig')
const CSVParser = require('json2csv').Parser
const { expressify } = require('@overleaf/promise-utils')

async function manageGroupMembers(req, res, next) {
  const { entity: subscription, entityConfig } = req

  const entityPrimaryKey =
    subscription[entityConfig.fields.primaryKey].toString()

  let entityName
  if (entityConfig.fields.name) {
    entityName = subscription[entityConfig.fields.name]
  }

  const users = await UserMembershipHandler.promises.getUsers(
    subscription,
    entityConfig
  )
  const ssoConfig = await SSOConfig.findById(subscription.ssoConfig).exec()

  res.render('user_membership/group-members-react', {
    name: entityName,
    groupId: entityPrimaryKey,
    users,
    groupSize: subscription.membersLimit,
    managedUsersActive: subscription.managedUsersEnabled,
    groupSSOActive: ssoConfig?.enabled,
  })
}

async function manageGroupManagers(req, res, next) {
  await _renderManagersPage(
    req,
    res,
    next,
    'user_membership/group-managers-react'
  )
}

async function manageInstitutionManagers(req, res, next) {
  await _renderManagersPage(
    req,
    res,
    next,
    'user_membership/institution-managers-react'
  )
}

async function managePublisherManagers(req, res, next) {
  await _renderManagersPage(
    req,
    res,
    next,
    'user_membership/publisher-managers-react'
  )
}

async function _renderManagersPage(req, res, next, template) {
  const { entity, entityConfig } = req

  const fetchV1Data = new Promise((resolve, reject) => {
    entity.fetchV1Data((error, entity) => {
      if (error) {
        reject(error)
      } else {
        resolve(entity)
      }
    })
  })

  const entityWithV1Data = await fetchV1Data

  const entityPrimaryKey =
    entityWithV1Data[entityConfig.fields.primaryKey].toString()
  let entityName
  if (entityConfig.fields.name) {
    entityName = entityWithV1Data[entityConfig.fields.name]
  }
  const users = await UserMembershipHandler.promises.getUsers(
    entityWithV1Data,
    entityConfig
  )

  res.render(template, {
    name: entityName,
    users,
    groupId: entityPrimaryKey,
  })
}

module.exports = {
  manageGroupMembers: expressify(manageGroupMembers),
  manageGroupManagers: expressify(manageGroupManagers),
  manageInstitutionManagers: expressify(manageInstitutionManagers),
  managePublisherManagers: expressify(managePublisherManagers),
  add(req, res, next) {
    const { entity, entityConfig } = req
    const email = EmailHelper.parseEmail(req.body.email)
    if (email == null) {
      return res.status(400).json({
        error: {
          code: 'invalid_email',
          message: req.i18n.translate('invalid_email'),
        },
      })
    }

    if (entityConfig.readOnly) {
      return next(new Errors.NotFoundError('Cannot add users to entity'))
    }

    UserMembershipHandler.addUser(
      entity,
      entityConfig,
      email,
      function (error, user) {
        if (error && error instanceof UserAlreadyAddedError) {
          return res.status(400).json({
            error: {
              code: 'user_already_added',
              message: req.i18n.translate('user_already_added'),
            },
          })
        }
        if (error && error instanceof UserNotFoundError) {
          return res.status(404).json({
            error: {
              code: 'user_not_found',
              message: req.i18n.translate('user_not_found'),
            },
          })
        }
        if (error != null) {
          return next(error)
        }
        res.json({ user })
      }
    )
  },
  remove(req, res, next) {
    const { entity, entityConfig } = req
    const { userId } = req.params

    if (entityConfig.readOnly) {
      return next(new Errors.NotFoundError('Cannot remove users from entity'))
    }

    const loggedInUserId = SessionManager.getLoggedInUserId(req.session)
    if (loggedInUserId === userId) {
      return res.status(400).json({
        error: {
          code: 'managers_cannot_remove_self',
          message: req.i18n.translate('managers_cannot_remove_self'),
        },
      })
    }

    UserMembershipHandler.removeUser(
      entity,
      entityConfig,
      userId,
      function (error, user) {
        if (error && error instanceof UserIsManagerError) {
          return res.status(400).json({
            error: {
              code: 'managers_cannot_remove_admin',
              message: req.i18n.translate('managers_cannot_remove_admin'),
            },
          })
        }
        if (error != null) {
          return next(error)
        }
        res.sendStatus(200)
      }
    )
  },
  exportCsv(req, res, next) {
    const { entity, entityConfig } = req
    const fields = ['email', 'last_logged_in_at', 'last_active_at']

    UserMembershipHandler.getUsers(
      entity,
      entityConfig,
      function (error, users) {
        if (error != null) {
          return next(error)
        }
        const csvParser = new CSVParser({ fields })
        csvAttachment(res, csvParser.parse(users), 'Group.csv')
      }
    )
  },
  new(req, res, next) {
    res.render('user_membership/new', {
      entityName: req.params.name,
      entityId: req.params.id,
    })
  },
  create(req, res, next) {
    const entityId = req.params.id
    const entityConfig = req.entityConfig

    UserMembershipHandler.createEntity(
      entityId,
      entityConfig,
      function (error, entity) {
        if (error != null) {
          return next(error)
        }
        res.redirect(entityConfig.pathsFor(entityId).index)
      }
    )
  },
}
