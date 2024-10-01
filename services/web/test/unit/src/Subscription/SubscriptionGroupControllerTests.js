const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionGroupController'

describe('SubscriptionGroupController', function () {
  beforeEach(function () {
    this.user = { _id: '!@312431', email: 'user@email.com' }
    this.adminUserId = '123jlkj'
    this.subscriptionId = '123434325412'
    this.user_email = 'bob@gmail.com'
    this.req = {
      session: {
        user: {
          _id: this.adminUserId,
          email: this.user_email,
        },
      },
      params: {
        subscriptionId: this.subscriptionId,
      },
      query: {},
    }

    this.subscription = {
      _id: this.subscriptionId,
    }

    this.SubscriptionGroupHandler = {
      promises: {
        removeUserFromGroup: sinon.stub().resolves(),
      },
    }

    this.SubscriptionLocator = {
      promises: {
        getSubscription: sinon.stub().resolves(this.subscription),
      },
    }

    this.SessionManager = {
      getLoggedInUserId(session) {
        return session.user._id
      },
      getSessionUser(session) {
        return session.user
      },
    }

    this.UserAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }

    this.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub().resolves(),
        },
      },
    }

    this.Controller = SandboxedModule.require(modulePath, {
      requires: {
        './SubscriptionGroupHandler': this.SubscriptionGroupHandler,
        './SubscriptionLocator': this.SubscriptionLocator,
        '../Authentication/SessionManager': this.SessionManager,
        '../User/UserAuditLogHandler': this.UserAuditLogHandler,
        '../../infrastructure/Modules': this.Modules,
      },
    })
  })

  describe('removeUserFromGroup', function () {
    it('should use the subscription id for the logged in user and take the user id from the params', function (done) {
      const userIdToRemove = '31231'
      this.req.params = { user_id: userIdToRemove }
      this.req.entity = this.subscription

      const res = {
        sendStatus: () => {
          this.SubscriptionGroupHandler.promises.removeUserFromGroup
            .calledWith(this.subscriptionId, userIdToRemove)
            .should.equal(true)
          done()
        },
      }
      this.Controller.removeUserFromGroup(this.req, res, done)
    })

    it('should log that the user has been removed', function (done) {
      const userIdToRemove = '31231'
      this.req.params = { user_id: userIdToRemove }
      this.req.entity = this.subscription

      const res = {
        sendStatus: () => {
          sinon.assert.calledWith(
            this.UserAuditLogHandler.promises.addEntry,
            userIdToRemove,
            'remove-from-group-subscription',
            this.adminUserId,
            this.req.ip,
            { subscriptionId: this.subscriptionId }
          )
          done()
        },
      }
      this.Controller.removeUserFromGroup(this.req, res, done)
    })

    it('should call the group SSO hooks with group SSO enabled', function (done) {
      const userIdToRemove = '31231'
      this.req.params = { user_id: userIdToRemove }
      this.req.entity = this.subscription
      this.Modules.promises.hooks.fire
        .withArgs('hasGroupSSOEnabled', this.subscription)
        .resolves([true])

      const res = {
        sendStatus: () => {
          this.Modules.promises.hooks.fire
            .calledWith('hasGroupSSOEnabled', this.subscription)
            .should.equal(true)
          this.Modules.promises.hooks.fire
            .calledWith(
              'unlinkUserFromGroupSSO',
              userIdToRemove,
              this.subscriptionId
            )
            .should.equal(true)
          sinon.assert.calledTwice(this.Modules.promises.hooks.fire)
          done()
        },
      }
      this.Controller.removeUserFromGroup(this.req, res, done)
    })

    it('should call the group SSO hooks with group SSO disabled', function (done) {
      const userIdToRemove = '31231'
      this.req.params = { user_id: userIdToRemove }
      this.req.entity = this.subscription
      this.Modules.promises.hooks.fire
        .withArgs('hasGroupSSOEnabled', this.subscription)
        .resolves([false])

      const res = {
        sendStatus: () => {
          this.Modules.promises.hooks.fire
            .calledWith('hasGroupSSOEnabled', this.subscription)
            .should.equal(true)
          sinon.assert.calledOnce(this.Modules.promises.hooks.fire)
          done()
        },
      }
      this.Controller.removeUserFromGroup(this.req, res, done)
    })
  })

  describe('removeSelfFromGroup', function () {
    it('gets subscription and remove user', function (done) {
      this.req.query = { subscriptionId: this.subscriptionId }
      const memberUserIdToremove = 123456789
      this.req.session.user._id = memberUserIdToremove

      const res = {
        sendStatus: () => {
          sinon.assert.calledWith(
            this.SubscriptionLocator.promises.getSubscription,
            this.subscriptionId
          )
          sinon.assert.calledWith(
            this.SubscriptionGroupHandler.promises.removeUserFromGroup,
            this.subscriptionId,
            memberUserIdToremove
          )
          done()
        },
      }
      this.Controller.removeSelfFromGroup(this.req, res, done)
    })

    it('should log that the user has left the subscription', function (done) {
      this.req.query = { subscriptionId: this.subscriptionId }
      const memberUserIdToremove = '123456789'
      this.req.session.user._id = memberUserIdToremove

      const res = {
        sendStatus: () => {
          sinon.assert.calledWith(
            this.UserAuditLogHandler.promises.addEntry,
            memberUserIdToremove,
            'remove-from-group-subscription',
            memberUserIdToremove,
            this.req.ip,
            { subscriptionId: this.subscriptionId }
          )
          done()
        },
      }
      this.Controller.removeSelfFromGroup(this.req, res, done)
    })

    it('should call the group SSO hooks with group SSO enabled', function (done) {
      this.req.query = { subscriptionId: this.subscriptionId }
      const memberUserIdToremove = '123456789'
      this.req.session.user._id = memberUserIdToremove

      this.Modules.promises.hooks.fire
        .withArgs('hasGroupSSOEnabled', this.subscription)
        .resolves([true])

      const res = {
        sendStatus: () => {
          this.Modules.promises.hooks.fire
            .calledWith('hasGroupSSOEnabled', this.subscription)
            .should.equal(true)
          this.Modules.promises.hooks.fire
            .calledWith(
              'unlinkUserFromGroupSSO',
              memberUserIdToremove,
              this.subscriptionId
            )
            .should.equal(true)
          sinon.assert.calledTwice(this.Modules.promises.hooks.fire)
          done()
        },
      }
      this.Controller.removeSelfFromGroup(this.req, res, done)
    })

    it('should call the group SSO hooks with group SSO disabled', function (done) {
      const userIdToRemove = '31231'
      this.req.session.user._id = userIdToRemove
      this.req.params = { user_id: userIdToRemove }
      this.req.entity = this.subscription
      this.Modules.promises.hooks.fire
        .withArgs('hasGroupSSOEnabled', this.subscription)
        .resolves([false])

      const res = {
        sendStatus: () => {
          this.Modules.promises.hooks.fire
            .calledWith('hasGroupSSOEnabled', this.subscription)
            .should.equal(true)
          sinon.assert.calledOnce(this.Modules.promises.hooks.fire)
          done()
        },
      }
      this.Controller.removeSelfFromGroup(this.req, res, done)
    })
  })
})
