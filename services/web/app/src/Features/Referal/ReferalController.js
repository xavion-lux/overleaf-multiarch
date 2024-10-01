const ReferalHandler = require('./ReferalHandler')
const SessionManager = require('../Authentication/SessionManager')

module.exports = {
  bonus(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    ReferalHandler.getReferedUsers(userId, (err, { referedUserCount }) => {
      if (err) {
        next(err)
      } else {
        res.render('referal/bonus', {
          refered_user_count: referedUserCount,
        })
      }
    })
  },
}
