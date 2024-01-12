const SessionManager = require('../Authentication/SessionManager')
const SubscriptionHandler = require('./SubscriptionHandler')
const SubscriptionViewModelBuilder = require('./SubscriptionViewModelBuilder')
const LimitationsManager = require('./LimitationsManager')
const RecurlyWrapper = require('./RecurlyWrapper')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const GeoIpLookup = require('../../infrastructure/GeoIpLookup')
const FeaturesUpdater = require('./FeaturesUpdater')
const planFeatures = require('./planFeatures')
const plansConfig = require('./plansConfig')
const interstitialPaymentConfig = require('./interstitialPaymentConfig')
const GroupPlansData = require('./GroupPlansData')
const V1SubscriptionManager = require('./V1SubscriptionManager')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const RecurlyEventHandler = require('./RecurlyEventHandler')
const { expressify } = require('@overleaf/promise-utils')
const OError = require('@overleaf/o-error')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')
const SubscriptionHelper = require('./SubscriptionHelper')
const AuthorizationManager = require('../Authorization/AuthorizationManager')
const Modules = require('../../infrastructure/Modules')
const async = require('async')

const groupPlanModalOptions = Settings.groupPlanModalOptions
const validGroupPlanModalOptions = {
  plan_code: groupPlanModalOptions.plan_codes.map(item => item.code),
  currency: groupPlanModalOptions.currencies.map(item => item.code),
  size: groupPlanModalOptions.sizes,
  usage: groupPlanModalOptions.usages.map(item => item.code),
}

async function plansPage(req, res) {
  const plans = SubscriptionViewModelBuilder.buildPlansList()

  let currency = null
  const queryCurrency = req.query.currency?.toUpperCase()
  if (GeoIpLookup.isValidCurrencyParam(queryCurrency)) {
    currency = queryCurrency
  }
  const {
    recommendedCurrency,
    countryCode,
    geoPricingINRTestVariant,
    geoPricingLATAMTestVariant,
  } = await _getRecommendedCurrency(req, res)
  if (recommendedCurrency && currency == null) {
    currency = recommendedCurrency
  }

  function getDefault(param, category, defaultValue) {
    const v = req.query && req.query[param]
    if (v && validGroupPlanModalOptions[category].includes(v)) {
      return v
    }
    return defaultValue
  }

  const currentView = 'annual'

  let defaultGroupPlanModalCurrency = 'USD'
  if (validGroupPlanModalOptions.currency.includes(currency)) {
    defaultGroupPlanModalCurrency = currency
  }
  const groupPlanModalDefaults = {
    plan_code: getDefault('plan', 'plan_code', 'collaborator'),
    size: getDefault('number', 'size', '2'),
    currency: getDefault('currency', 'currency', defaultGroupPlanModalCurrency),
    usage: getDefault('usage', 'usage', 'enterprise'),
  }

  let showInrGeoBanner, inrGeoBannerSplitTestName
  let inrGeoBannerVariant = 'default'
  if (countryCode === 'IN') {
    inrGeoBannerSplitTestName =
      geoPricingINRTestVariant === 'inr'
        ? 'geo-banners-inr-2'
        : 'geo-banners-inr-1'
    try {
      const geoBannerAssignment = await SplitTestHandler.promises.getAssignment(
        req,
        res,
        inrGeoBannerSplitTestName
      )
      inrGeoBannerVariant = geoBannerAssignment.variant
      if (inrGeoBannerVariant !== 'default') {
        showInrGeoBanner = true
      }
    } catch (error) {
      logger.error(
        { err: error },
        `Failed to get INR geo banner lookup or assignment (${inrGeoBannerSplitTestName})`
      )
    }
  }

  // annual plans with the free trial option split test - nudge variant
  let annualTrialsAssignment = { variant: 'default' }

  try {
    annualTrialsAssignment = await SplitTestHandler.promises.getAssignment(
      req,
      res,
      'annual-trials'
    )
  } catch (error) {
    logger.error(
      { err: error },
      'failed to get "annualTrialsAssignment" split test assignment'
    )
  }

  const websiteRedesignVariant =
    res.locals.splitTestVariants?.['website-redesign']

  const plansPageViewSegmentation = {
    currency: recommendedCurrency,
    countryCode,
    'geo-pricing-inr-group': geoPricingINRTestVariant,
    'geo-pricing-inr-page': currency === 'INR' ? 'inr' : 'default',
    'geo-pricing-latam-group': geoPricingLATAMTestVariant,
    'geo-pricing-latam-page': ['BRL', 'MXN', 'COP', 'CLP', 'PEN'].includes(
      currency
    )
      ? 'latam'
      : 'default',
    'annual-trials': annualTrialsAssignment.variant,
    'website-redesign': websiteRedesignVariant,
  }
  if (inrGeoBannerSplitTestName) {
    plansPageViewSegmentation[inrGeoBannerSplitTestName] = inrGeoBannerVariant
  }

  AnalyticsManager.recordEventForSession(
    req.session,
    'plans-page-view',
    plansPageViewSegmentation
  )

  res.render('subscriptions/plans', {
    title: 'plans_and_pricing',
    currentView,
    plans,
    itm_content: req.query?.itm_content,
    itm_referrer: req.query?.itm_referrer,
    itm_campaign: 'plans',
    recommendedCurrency: currency,
    planFeatures,
    plansConfig,
    groupPlans: GroupPlansData,
    groupPlanModalOptions,
    groupPlanModalDefaults,
    initialLocalizedGroupPrice:
      SubscriptionHelper.generateInitialLocalizedGroupPrice(currency),
    showInrGeoBanner,
    annualTrialsAssignment: annualTrialsAssignment?.variant,
  })
}

function formatGroupPlansDataForDash() {
  return {
    plans: [...groupPlanModalOptions.plan_codes],
    sizes: [...groupPlanModalOptions.sizes],
    usages: [...groupPlanModalOptions.usages],
    priceByUsageTypeAndSize: JSON.parse(JSON.stringify(GroupPlansData)),
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function userSubscriptionPage(req, res) {
  const user = SessionManager.getSessionUser(req.session)
  const results =
    await SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
      user
    )
  const {
    personalSubscription,
    memberGroupSubscriptions,
    managedGroupSubscriptions,
    currentInstitutionsWithLicence,
    managedInstitutions,
    managedPublishers,
  } = results
  const hasSubscription =
    await LimitationsManager.promises.userHasV1OrV2Subscription(user)
  const fromPlansPage = req.query.hasSubscription
  const plansData =
    SubscriptionViewModelBuilder.buildPlansListForSubscriptionDash(
      personalSubscription?.plan
    )

  AnalyticsManager.recordEventForSession(req.session, 'subscription-page-view')

  const cancelButtonAssignment = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'subscription-cancel-button'
  )

  const cancelButtonNewCopy = cancelButtonAssignment?.variant === 'new-copy'

  const groupPlansDataForDash = formatGroupPlansDataForDash()

  // display the Group Settings button only to admins of group subscriptions with either/or the Managed Users or Group SSO feature available
  let groupSettingsEnabledFor
  try {
    const managedGroups = await async.filter(
      managedGroupSubscriptions || [],
      async subscription => {
        const managedUsersResults = await Modules.promises.hooks.fire(
          'hasManagedUsersFeature',
          subscription
        )
        const groupSSOResults = await Modules.promises.hooks.fire(
          'hasGroupSSOFeature',
          subscription
        )
        const isGroupAdmin =
          (subscription.admin_id._id || subscription.admin_id).toString() ===
          user._id.toString()
        return (
          (managedUsersResults?.[0] === true ||
            groupSSOResults?.[0] === true) &&
          isGroupAdmin
        )
      }
    )
    groupSettingsEnabledFor = managedGroups.map(subscription =>
      subscription._id.toString()
    )
  } catch (error) {
    logger.error(
      { err: error },
      'Failed to list groups with group settings enabled'
    )
  }

  const data = {
    title: 'your_subscription',
    plans: plansData?.plans,
    planCodesChangingAtTermEnd: plansData?.planCodesChangingAtTermEnd,
    user,
    hasSubscription,
    fromPlansPage,
    personalSubscription,
    memberGroupSubscriptions,
    managedGroupSubscriptions,
    managedInstitutions,
    managedPublishers,
    currentInstitutionsWithLicence,
    cancelButtonNewCopy,
    groupPlans: groupPlansDataForDash,
    groupSettingsEnabledFor,
    isManagedAccount: !!req.managedBy,
    userRestrictions: Array.from(req.userRestrictions || []),
  }
  res.render('subscriptions/dashboard-react', data)
}

async function interstitialPaymentPage(req, res) {
  const user = SessionManager.getSessionUser(req.session)
  const {
    recommendedCurrency,
    countryCode,
    geoPricingINRTestVariant,
    geoPricingLATAMTestVariant,
  } = await _getRecommendedCurrency(req, res)

  const hasSubscription =
    await LimitationsManager.promises.userHasV1OrV2Subscription(user)

  const showSkipLink = req.query?.skipLink === 'true'

  if (hasSubscription) {
    res.redirect('/user/subscription?hasSubscription=true')
  } else {
    let showInrGeoBanner, inrGeoBannerSplitTestName
    let inrGeoBannerVariant = 'default'
    if (countryCode === 'IN') {
      inrGeoBannerSplitTestName =
        geoPricingINRTestVariant === 'inr'
          ? 'geo-banners-inr-2'
          : 'geo-banners-inr-1'
      try {
        const geoBannerAssignment =
          await SplitTestHandler.promises.getAssignment(
            req,
            res,
            inrGeoBannerSplitTestName
          )
        inrGeoBannerVariant = geoBannerAssignment.variant
        if (inrGeoBannerVariant !== 'default') {
          showInrGeoBanner = true
        }
      } catch (error) {
        logger.error(
          { err: error },
          `Failed to get INR geo banner lookup or assignment (${inrGeoBannerSplitTestName})`
        )
      }
    }

    // annual plans with the free trial option split test - nudge variant
    let annualTrialsAssignment = { variant: 'default' }

    try {
      annualTrialsAssignment = await SplitTestHandler.promises.getAssignment(
        req,
        res,
        'annual-trials'
      )
    } catch (error) {
      logger.error(
        { err: error },
        'failed to get "annualTrialsAssignment" split test assignment'
      )
    }

    const paywallPlansPageViewSegmentation = {
      currency: recommendedCurrency,
      countryCode,
      'geo-pricing-inr-group': geoPricingINRTestVariant,
      'geo-pricing-inr-page': recommendedCurrency === 'INR' ? 'inr' : 'default',
      'geo-pricing-latam-group': geoPricingLATAMTestVariant,
      'geo-pricing-latam-page': ['BRL', 'MXN', 'COP', 'CLP', 'PEN'].includes(
        recommendedCurrency
      )
        ? 'latam'
        : 'default',
      'annual-trials': annualTrialsAssignment.variant,
    }
    if (inrGeoBannerSplitTestName) {
      paywallPlansPageViewSegmentation[inrGeoBannerSplitTestName] =
        inrGeoBannerVariant
    }
    AnalyticsManager.recordEventForSession(
      req.session,
      'paywall-plans-page-view',
      paywallPlansPageViewSegmentation
    )

    let templatePath

    switch (annualTrialsAssignment?.variant) {
      case 'nudge':
        templatePath = 'subscriptions/interstitial-payment_nudge_annual'
        break
      case 'no-nudge':
        templatePath = 'subscriptions/interstitial-payment_no_nudge_monthly'
        break
      default:
        templatePath = 'subscriptions/interstitial-payment'
    }

    res.render(templatePath, {
      title: 'subscribe',
      itm_content: req.query?.itm_content,
      itm_campaign: req.query?.itm_campaign,
      itm_referrer: req.query?.itm_referrer,
      recommendedCurrency,
      interstitialPaymentConfig,
      showSkipLink,
      showInrGeoBanner,
    })
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function successfulSubscription(req, res) {
  const user = SessionManager.getSessionUser(req.session)
  const { personalSubscription } =
    await SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
      user
    )

  const postCheckoutRedirect = req.session?.postCheckoutRedirect

  if (!personalSubscription) {
    res.redirect('/user/subscription/plans')
  } else {
    res.render('subscriptions/successful-subscription-react', {
      title: 'thank_you',
      personalSubscription,
      postCheckoutRedirect,
    })
  }
}

function cancelSubscription(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  logger.debug({ userId: user._id }, 'canceling subscription')
  SubscriptionHandler.cancelSubscription(user, function (err) {
    if (err) {
      OError.tag(err, 'something went wrong canceling subscription', {
        user_id: user._id,
      })
      return next(err)
    }
    // Note: this redirect isn't used in the main flow as the redirection is
    // handled by Angular
    res.redirect('/user/subscription/canceled')
  })
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
function canceledSubscription(req, res, next) {
  return res.render('subscriptions/canceled-subscription-react', {
    title: 'subscription_canceled',
  })
}

function cancelV1Subscription(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  logger.debug({ userId }, 'canceling v1 subscription')
  V1SubscriptionManager.cancelV1Subscription(userId, function (err) {
    if (err) {
      OError.tag(err, 'something went wrong canceling v1 subscription', {
        userId,
      })
      return next(err)
    }
    res.redirect('/user/subscription')
  })
}

function updateSubscription(req, res, next) {
  const origin = req && req.query ? req.query.origin : null
  const user = SessionManager.getSessionUser(req.session)
  const planCode = req.body.plan_code
  if (planCode == null) {
    const err = new Error('plan_code is not defined')
    logger.warn(
      { userId: user._id, err, planCode, origin, body: req.body },
      '[Subscription] error in updateSubscription form'
    )
    return next(err)
  }
  logger.debug({ planCode, userId: user._id }, 'updating subscription')
  SubscriptionHandler.updateSubscription(user, planCode, null, function (err) {
    if (err) {
      OError.tag(err, 'something went wrong updating subscription', {
        user_id: user._id,
      })
      return next(err)
    }
    res.redirect('/user/subscription')
  })
}

function cancelPendingSubscriptionChange(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  logger.debug({ userId: user._id }, 'canceling pending subscription change')
  SubscriptionHandler.cancelPendingSubscriptionChange(user, function (err) {
    if (err) {
      OError.tag(
        err,
        'something went wrong canceling pending subscription change',
        {
          user_id: user._id,
        }
      )
      return next(err)
    }
    res.redirect('/user/subscription')
  })
}

function updateAccountEmailAddress(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  RecurlyWrapper.updateAccountEmailAddress(
    user._id,
    user.email,
    function (error) {
      if (error) {
        return next(error)
      }
      res.sendStatus(200)
    }
  )
}

function reactivateSubscription(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  logger.debug({ userId: user._id }, 'reactivating subscription')
  try {
    if (req.isManagedGroupAdmin) {
      // allow admins to reactivate subscriptions
    } else {
      // otherwise require the user to have the reactivate-subscription permission
      req.assertPermission('reactivate-subscription')
    }
  } catch (error) {
    return next(error)
  }
  SubscriptionHandler.reactivateSubscription(user, function (err) {
    if (err) {
      OError.tag(err, 'something went wrong reactivating subscription', {
        user_id: user._id,
      })
      return next(err)
    }
    res.redirect('/user/subscription')
  })
}

function recurlyCallback(req, res, next) {
  logger.debug({ data: req.body }, 'received recurly callback')
  const event = Object.keys(req.body)[0]
  const eventData = req.body[event]

  RecurlyEventHandler.sendRecurlyAnalyticsEvent(event, eventData).catch(error =>
    logger.error(
      { err: error },
      'Failed to process analytics event on Recurly webhook'
    )
  )

  if (
    [
      'new_subscription_notification',
      'updated_subscription_notification',
      'expired_subscription_notification',
    ].includes(event)
  ) {
    const recurlySubscription = eventData.subscription
    SubscriptionHandler.syncSubscription(
      recurlySubscription,
      { ip: req.ip },
      function (err) {
        if (err) {
          return next(err)
        }
        res.sendStatus(200)
      }
    )
  } else if (event === 'billing_info_updated_notification') {
    const recurlyAccountCode = eventData.account.account_code
    SubscriptionHandler.attemptPaypalInvoiceCollection(
      recurlyAccountCode,
      function (err) {
        if (err) {
          return next(err)
        }
        res.sendStatus(200)
      }
    )
  } else {
    res.sendStatus(200)
  }
}

function renderUpgradeToAnnualPlanPage(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  LimitationsManager.userHasV2Subscription(
    user,
    function (err, hasSubscription, subscription) {
      let planName
      if (err) {
        return next(err)
      }
      const planCode = subscription
        ? subscription.planCode.toLowerCase()
        : undefined
      if ((planCode ? planCode.indexOf('annual') : undefined) !== -1) {
        planName = 'annual'
      } else if ((planCode ? planCode.indexOf('student') : undefined) !== -1) {
        planName = 'student'
      } else if (
        (planCode ? planCode.indexOf('collaborator') : undefined) !== -1
      ) {
        planName = 'collaborator'
      }
      if (hasSubscription) {
        res.render('subscriptions/upgradeToAnnual', {
          title: 'Upgrade to annual',
          planName,
        })
      } else {
        res.redirect('/user/subscription/plans')
      }
    }
  )
}

function processUpgradeToAnnualPlan(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  const { planName } = req.body
  const couponCode = Settings.coupon_codes.upgradeToAnnualPromo[planName]
  const annualPlanName = `${planName}-annual`
  logger.debug(
    { userId: user._id, planName: annualPlanName },
    'user is upgrading to annual billing with discount'
  )
  return SubscriptionHandler.updateSubscription(
    user,
    annualPlanName,
    couponCode,
    function (err) {
      if (err) {
        OError.tag(err, 'error updating subscription', {
          user_id: user._id,
        })
        return next(err)
      }
      res.sendStatus(200)
    }
  )
}

async function extendTrial(req, res) {
  const user = SessionManager.getSessionUser(req.session)
  const { subscription } =
    await LimitationsManager.promises.userHasV2Subscription(user)

  try {
    await SubscriptionHandler.promises.extendTrial(subscription, 14)
    AnalyticsManager.recordEventForSession(
      req.session,
      'subscription-trial-extended'
    )
  } catch (error) {
    return res.sendStatus(500)
  }
  res.sendStatus(200)
}

function recurlyNotificationParser(req, res, next) {
  let xml = ''
  req.on('data', chunk => (xml += chunk))
  req.on('end', () =>
    RecurlyWrapper._parseXml(xml, function (error, body) {
      if (error) {
        return next(error)
      }
      req.body = body
      next()
    })
  )
}

async function refreshUserFeatures(req, res) {
  const { user_id: userId } = req.params
  await FeaturesUpdater.promises.refreshFeatures(userId, 'acceptance-test')
  res.sendStatus(200)
}

async function redirectToHostedPage(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { pageType } = req.params
  const url =
    await SubscriptionViewModelBuilder.promises.getRedirectToHostedPage(
      userId,
      pageType
    )
  logger.warn({ userId, pageType }, 'redirecting to recurly hosted page')
  res.redirect(url)
}

async function _getRecommendedCurrency(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  let ip = req.ip
  if (
    req.query?.ip &&
    (await AuthorizationManager.promises.isUserSiteAdmin(userId))
  ) {
    ip = req.query.ip
  }
  const currencyLookup = await GeoIpLookup.promises.getCurrencyCode(ip)
  const countryCode = currencyLookup.countryCode
  let assignmentINR, assignmentLATAM
  let recommendedCurrency = currencyLookup.currencyCode
  // for #12703
  try {
    // Split test is kept active, but all users geolocated in India can
    // now use the INR currency (See #13507)
    assignmentINR = await SplitTestHandler.promises.getAssignment(
      req,
      res,
      'geo-pricing-inr'
    )
  } catch (error) {
    logger.error(
      { err: error },
      'Failed to get assignment for geo-pricing-inr test'
    )
  }
  // for #13559
  try {
    assignmentLATAM = await SplitTestHandler.promises.getAssignment(
      req,
      res,
      'geo-pricing-latam'
    )
  } catch (error) {
    logger.error(
      { err: error },
      'Failed to get assignment for geo-pricing-latam test'
    )
  }
  if (
    ['BRL', 'MXN', 'COP', 'CLP', 'PEN'].includes(recommendedCurrency) &&
    assignmentLATAM?.variant !== 'latam'
  ) {
    recommendedCurrency = GeoIpLookup.DEFAULT_CURRENCY_CODE
  }
  return {
    recommendedCurrency,
    countryCode,
    geoPricingINRTestVariant: assignmentINR?.variant,
    geoPricingLATAMTestVariant: assignmentLATAM?.variant,
  }
}

module.exports = {
  plansPage: expressify(plansPage),
  userSubscriptionPage: expressify(userSubscriptionPage),
  interstitialPaymentPage: expressify(interstitialPaymentPage),
  successfulSubscription: expressify(successfulSubscription),
  cancelSubscription,
  canceledSubscription,
  cancelV1Subscription,
  updateSubscription,
  cancelPendingSubscriptionChange,
  updateAccountEmailAddress,
  reactivateSubscription,
  recurlyCallback,
  renderUpgradeToAnnualPlanPage,
  processUpgradeToAnnualPlan,
  extendTrial: expressify(extendTrial),
  recurlyNotificationParser,
  refreshUserFeatures: expressify(refreshUserFeatures),
  redirectToHostedPage: expressify(redirectToHostedPage),
  promises: {
    getRecommendedCurrency: _getRecommendedCurrency,
  },
}
