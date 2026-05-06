import { useEffect, useMemo, useState } from 'react';
import { ChefHat, RefreshCcw, Send, Settings2 } from 'lucide-react';
import { api } from '../api';

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40';

const badgeByStatus = {
  pending: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  preparing: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  created: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  confirmed: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  completed: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  pending_chef: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  delivered_to_customer: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  approved: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  rejected: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  'auto-approved': 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/30',
};

const QUICK_REPLIES = [
  'Will be ready in 5 minutes.',
  'We are out of that ingredient.',
  'Confirmed, making it now!',
];

function StatusBadge({ status }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
        badgeByStatus[status] || 'bg-slate-700 text-slate-200 ring-slate-600',
      ].join(' ')}
    >
      {status || 'unknown'}
    </span>
  );
}

function formatDateTime(value) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString();
}

export default function ChefDashboard() {
  const [ordersData, setOrdersData] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);
  const [statusUpdatingOrderId, setStatusUpdatingOrderId] = useState(null);
  const [sendingOrderId, setSendingOrderId] = useState(null);
  const [replyingMessageId, setReplyingMessageId] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [directDrafts, setDirectDrafts] = useState({});
  const [adjustModal, setAdjustModal] = useState({
    open: false,
    orderId: '',
    ingredientId: '',
    ingredientIdManual: '',
  });

  async function loadChefData() {
    setError('');
    try {
      const [activeOrders, inventory] = await Promise.all([
        api('/chef/active-orders'),
        api('/api/admin/inventory').catch(() => []),
      ]);
      setOrdersData(Array.isArray(activeOrders) ? activeOrders : []);
      setInventoryItems(Array.isArray(inventory) ? inventory : []);
    } catch (err) {
      setError(err?.message || 'Failed to load chef panel data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadChefData();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadChefData();
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  const activeOrders = useMemo(
    () => ordersData.filter((entry) => !!entry?.order?.id),
    [ordersData]
  );

  const pendingAiRequests = useMemo(() => {
    return activeOrders.flatMap((entry) => {
      const pending = Array.isArray(entry.pending_ai_messages)
        ? entry.pending_ai_messages
        : [];
      return pending.map((message) => ({
        ...message,
        order_id: entry.order.id,
        order_status: entry.order.status,
      }));
    });
  }, [activeOrders]);

  function openAdjustmentModal(orderId) {
    setNotice('');
    setAdjustModal({
      open: true,
      orderId: String(orderId ?? activeOrders[0]?.order?.id ?? ''),
      ingredientId: String(inventoryItems[0]?.id ?? ''),
      ingredientIdManual: '',
    });
  }

  function closeAdjustmentModal() {
    setAdjustModal({
      open: false,
      orderId: '',
      ingredientId: '',
      ingredientIdManual: '',
    });
  }

  async function submitInventoryAdjustment(event) {
    event.preventDefault();
    const orderId = Number(adjustModal.orderId);
    const ingredientId = inventoryItems.length
      ? Number(adjustModal.ingredientId)
      : Number(adjustModal.ingredientIdManual);

    if (!Number.isFinite(orderId) || !Number.isFinite(ingredientId)) {
      setError('Please select a valid order and ingredient.');
      return;
    }

    setSubmittingAdjustment(true);
    setError('');
    setNotice('');
    try {
      await api('/chef/inventory-adjust', {
        method: 'POST',
        body: JSON.stringify({
          order_id: orderId,
          ingredient_id: ingredientId,
        }),
      });
      setNotice('Inventory adjustment request sent to admins.');
      closeAdjustmentModal();
      await loadChefData();
    } catch (err) {
      setError(err?.message || 'Failed to submit inventory adjustment request');
    } finally {
      setSubmittingAdjustment(false);
    }
  }

  async function submitChefReply(messageId) {
    const text = String(replyDrafts[messageId] || '').trim();
    if (!text) {
      setError('Chef reply cannot be empty.');
      return;
    }

    setReplyingMessageId(messageId);
    setError('');
    setNotice('');
    try {
      await api('/chef/reply-ai', {
        method: 'POST',
        body: JSON.stringify({
          ai_chef_message_id: Number(messageId),
          chef_reply_text: text,
        }),
      });
      setReplyDrafts((prev) => ({ ...prev, [messageId]: '' }));
      setNotice('Chef reply delivered through AI mediator.');
      await loadChefData();
    } catch (err) {
      setError(err?.message || 'Failed to submit chef reply');
    } finally {
      setReplyingMessageId(null);
    }
  }

  async function updateOrderStatus(orderId, status) {
    setStatusUpdatingOrderId(orderId);
    setError('');
    try {
      await api(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadChefData();
    } catch (err) {
      setError(err?.message || 'Failed to update order status');
    } finally {
      setStatusUpdatingOrderId(null);
    }
  }

  async function sendChefMessage(orderId, text) {
    const message = String(text || '').trim();
    if (!message) return;
    setSendingOrderId(orderId);
    setError('');
    try {
      await api(`/chef/orders/${orderId}/message`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      setDirectDrafts((prev) => ({ ...prev, [orderId]: '' }));
    } catch (err) {
      setError(err?.message || 'Failed to send message');
    } finally {
      setSendingOrderId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Chef Panel</h2>
          <p className="mt-1 text-sm text-slate-400">
            Live kitchen view for active orders, inventory adjustment requests, and AI-routed customer questions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadChefData()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-5">
        <section className="space-y-4 2xl:col-span-3">
          <div className="flex items-center gap-2 text-slate-200">
            <ChefHat size={17} className="text-amber-300" />
            <h3 className="text-base font-semibold">Active Orders ({activeOrders.length})</h3>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-8 text-center text-sm text-slate-400">
              Loading active orders...
            </div>
          ) : activeOrders.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-8 text-center text-sm text-slate-400">
              No active orders right now.
            </div>
          ) : (
            activeOrders.map((entry) => {
              const order = entry.order || {};
              const items = Array.isArray(entry.items) ? entry.items : [];
              const adjustmentRequests = Array.isArray(entry.inventory_adjustment_requests)
                ? entry.inventory_adjustment_requests
                : [];
              const kitchenNotes = Array.isArray(entry.kitchen_notes) ? entry.kitchen_notes : [];
              const isGuestOrder = order.user_id == null;

              return (
                <article key={order.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-400">Order #{order.id}</p>
                      <p className="text-xs text-slate-500">Created: {formatDateTime(order.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={order.status} />
                      {order.status === 'pending' && (
                        <button
                          type="button"
                          disabled={statusUpdatingOrderId === order.id}
                          onClick={() => updateOrderStatus(order.id, 'preparing')}
                          className="inline-flex items-center rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Start Preparing
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          type="button"
                          disabled={statusUpdatingOrderId === order.id}
                          onClick={() => updateOrderStatus(order.id, 'completed')}
                          className="inline-flex items-center rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Mark as Done
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openAdjustmentModal(order.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3 py-2 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/25"
                      >
                        <Settings2 size={14} />
                        Request Inventory Adjustment
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="min-w-full text-sm text-slate-200">
                      <thead className="bg-slate-950/90 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Dish</th>
                          <th className="px-4 py-3 text-right font-semibold">Qty</th>
                          <th className="px-4 py-3 text-right font-semibold">Unit price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-4 text-center text-slate-400">
                              No items found for this order.
                            </td>
                          </tr>
                        ) : (
                          items.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-800/40">
                              <td className="px-4 py-3">{item.product_name || `Product #${item.product_id}`}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{item.count}</td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {Number(item.unit_price || 0).toLocaleString()} AMD
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Message to customer
                      </label>
                      {isGuestOrder && (
                        <span className="text-xs font-semibold text-amber-300">
                          Guest order — no customer to message
                        </span>
                      )}
                    </div>
                    <input
                      value={directDrafts[order.id] || ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDirectDrafts((prev) => ({ ...prev, [order.id]: value }));
                      }}
                      placeholder={isGuestOrder ? 'Guest order' : 'Type a direct message...'}
                      disabled={isGuestOrder}
                      className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                    />
                    <button
                      type="button"
                      disabled={isGuestOrder || sendingOrderId === order.id}
                      onClick={() => sendChefMessage(order.id, directDrafts[order.id])}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Send size={15} />
                      {sendingOrderId === order.id ? 'Sending...' : 'Send Message'}
                    </button>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {QUICK_REPLIES.map((text) => (
                        <button
                          key={text}
                          type="button"
                          disabled={isGuestOrder}
                          onClick={() => sendChefMessage(order.id, text)}
                          className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(adjustmentRequests.length > 0 || kitchenNotes.length > 0) && (
                    <div className="mt-4 space-y-3">
                      {adjustmentRequests.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Inventory Adjustment Requests
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {adjustmentRequests.map((req) => (
                              <span
                                key={req.id}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-300"
                              >
                                #{req.id} {req.ingredient_name || `Ingredient ${req.ingredient_id}`} <StatusBadge status={req.status} />
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {kitchenNotes.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Kitchen Notes (Auto-approved)
                          </p>
                          <ul className="space-y-2">
                            {kitchenNotes.map((note) => (
                              <li key={note.id} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                                {note.complex_request_text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>

        <section className="space-y-4 2xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-100">Pending AI Complex Requests</h3>
            <span className="rounded-full border border-orange-500/40 bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-300">
              {pendingAiRequests.length} pending
            </span>
          </div>

          {pendingAiRequests.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-8 text-center text-sm text-slate-400">
              AI has no pending complex requests for the chef.
            </div>
          ) : (
            pendingAiRequests.map((request) => (
              <article key={request.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-100">Request #{request.id}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Order #{request.order_id}</span>
                    <StatusBadge status={request.order_status} />
                  </div>
                </div>

                <p className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-200">
                  {request.complex_request_text}
                </p>

                <div className="mt-3 space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Chef raw reply
                  </label>
                  <textarea
                    rows={3}
                    value={replyDrafts[request.id] || ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setReplyDrafts((prev) => ({ ...prev, [request.id]: value }));
                    }}
                    placeholder="Write your raw instruction for AI to polish and send to customer"
                    className={INPUT_CLASS}
                  />
                  <button
                    type="button"
                    disabled={replyingMessageId === request.id}
                    onClick={() => submitChefReply(request.id)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send size={15} />
                    {replyingMessageId === request.id ? 'Replying to AI...' : 'Reply to AI'}
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      {adjustModal.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-100">Request Inventory Adjustment</h3>
            <p className="mt-1 text-sm text-slate-400">
              Select an active order and ingredient that should not be deducted for this order.
            </p>

            <form className="mt-4 space-y-4" onSubmit={submitInventoryAdjustment}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Order</label>
                <select
                  value={adjustModal.orderId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setAdjustModal((prev) => ({ ...prev, orderId: value }));
                  }}
                  className={INPUT_CLASS}
                  required
                >
                  <option value="" disabled>
                    Select order
                  </option>
                  {activeOrders.map((entry) => (
                    <option key={entry.order.id} value={entry.order.id}>
                      Order #{entry.order.id} ({entry.order.status})
                    </option>
                  ))}
                </select>
              </div>

              {inventoryItems.length > 0 ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Ingredient</label>
                  <select
                    value={adjustModal.ingredientId}
                    onChange={(event) => {
                      const value = event.target.value;
                      setAdjustModal((prev) => ({ ...prev, ingredientId: value }));
                    }}
                    className={INPUT_CLASS}
                    required
                  >
                    <option value="" disabled>
                      Select ingredient
                    </option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({Number(item.quantity || 0).toFixed(1)} {item.unit})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Ingredient ID</label>
                  <input
                    type="number"
                    min="1"
                    value={adjustModal.ingredientIdManual}
                    onChange={(event) => {
                      const value = event.target.value;
                      setAdjustModal((prev) => ({ ...prev, ingredientIdManual: value }));
                    }}
                    className={INPUT_CLASS}
                    placeholder="Enter ingredient id"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAdjustmentModal}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjustment}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingAdjustment ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}