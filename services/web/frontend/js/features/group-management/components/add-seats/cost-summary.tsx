import { Trans, useTranslation } from 'react-i18next'
import { Card, ListGroup } from 'react-bootstrap-5'
import { formatCurrencyLocalized } from '@/shared/utils/currency'
import { formatTime } from '@/features/utils/format-date'
import {
  AddOnUpdate,
  SubscriptionChangePreview,
} from '../../../../../../types/subscription/subscription-change-preview'
import { MergeAndOverride } from '../../../../../../types/utils'

type CostSummaryProps = {
  subscriptionChange: MergeAndOverride<
    SubscriptionChangePreview,
    { change: AddOnUpdate }
  > | null
  totalLicenses: number
}

function CostSummary({ subscriptionChange, totalLicenses }: CostSummaryProps) {
  const { t } = useTranslation()

  return (
    <Card
      className="card-gray card-description-secondary"
      data-testid="cost-summary"
    >
      <Card.Body className="d-grid gap-2 p-3">
        <div>
          <div className="fw-bold">{t('cost_summary')}</div>
          {subscriptionChange ? (
            <Trans
              i18nKey="youre_adding_x_users_to_your_plan_giving_you_a_total_of_y_users"
              components={[
                <b />, // eslint-disable-line react/jsx-key
                <b />, // eslint-disable-line react/jsx-key
              ]}
              values={{
                adding:
                  subscriptionChange.change.addOn.quantity -
                  subscriptionChange.change.addOn.prevQuantity,
                total:
                  totalLicenses +
                  subscriptionChange.change.addOn.quantity -
                  subscriptionChange.change.addOn.prevQuantity,
              }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
            />
          ) : (
            t(
              'enter_the_number_of_users_youd_like_to_add_to_see_the_cost_breakdown'
            )
          )}
        </div>
        {subscriptionChange && (
          <>
            <div>
              <ListGroup>
                <ListGroup.Item
                  className="bg-transparent border-0 px-0 gap-3 card-description-secondary"
                  data-testid="plan"
                >
                  <span className="me-auto">
                    {subscriptionChange.nextInvoice.plan.name} x{' '}
                    {subscriptionChange.change.addOn.quantity -
                      subscriptionChange.change.addOn.prevQuantity}{' '}
                    {t('seats')}
                  </span>
                  <span data-testid="price">
                    {formatCurrencyLocalized(
                      subscriptionChange.immediateCharge.subtotal,
                      subscriptionChange.currency
                    )}
                  </span>
                </ListGroup.Item>
                <ListGroup.Item
                  className="bg-transparent border-0 px-0 gap-3 card-description-secondary"
                  data-testid="tax"
                >
                  <span className="me-auto">
                    {t('sales_tax')} &middot;{' '}
                    {subscriptionChange.nextInvoice.tax.rate * 100}%
                  </span>
                  <span data-testid="price">
                    {formatCurrencyLocalized(
                      subscriptionChange.immediateCharge.tax,
                      subscriptionChange.currency
                    )}
                  </span>
                </ListGroup.Item>
                <ListGroup.Item
                  className="bg-transparent border-0 px-0 gap-3 card-description-secondary"
                  data-testid="total"
                >
                  <strong className="me-auto">{t('total_due_today')}</strong>
                  <strong data-testid="price">
                    {formatCurrencyLocalized(
                      subscriptionChange.immediateCharge.total,
                      subscriptionChange.currency
                    )}
                  </strong>
                </ListGroup.Item>
              </ListGroup>
              <hr className="m-0" />
            </div>
            <div>
              {t(
                'we_will_charge_you_now_for_the_cost_of_your_additional_users_based_on_remaining_months'
              )}
            </div>
            <div>
              {t(
                'after_that_well_bill_you_x_annually_on_date_unless_you_cancel',
                {
                  subtotal: formatCurrencyLocalized(
                    subscriptionChange.nextInvoice.total,
                    subscriptionChange.currency
                  ),
                  date: formatTime(
                    subscriptionChange.nextInvoice.date,
                    'MMMM D'
                  ),
                }
              )}
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  )
}

export default CostSummary
