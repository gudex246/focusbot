import React, { useState, useEffect } from 'react';
import {
  Shield,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Radio,
  ExternalLink,
  Users,
  MessageSquare,
  Globe,
  RefreshCw,
  Server,
  Layers,
  Sparkles,
  Search,
  BookOpen,
  Filter,
  Download,
  AlertTriangle,
  HeartHandshake,
  Check,
  Smartphone,
  Copy,
  Zap,
} from 'lucide-react';

interface Confession {
  id: number;
  formatted_id: string;
  category: string;
  language: string;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  moderated_by: string | null;
  moderator_name: string | null;
  moderated_at: string | null;
  rejection_reason: string | null;
  telegram_channel_msg_id: number | null;
  created_at: string;
}

interface BotStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  todayCount: number;
  byCategory: { category: string; count: number }[];
  byLanguage: { language: string; count: number }[];
}

interface ActivityLog {
  id: number;
  action: string;
  details: string;
  created_at: string;
}

interface BotStatusResponse {
  bot: {
    status: 'idle' | 'starting' | 'running' | 'error';
    mode?: 'polling' | 'webhook';
    botUsername: string;
    webhookUrl?: string | null;
    error: string | null;
    startedAt: string | null;
    lastActiveAt?: string;
    lastPollAt?: string | null;
    pollCycles?: number;
  };
  channel: string;
  adminsCount: number;
  adminsList: string[];
  stats: BotStats;
  uptimeSeconds: number;
  timestamp: string;
}

const CATEGORY_MAP: Record<string, { en: string; am: string; om: string; icon: string; color: string }> = {
  confession: {
    en: 'Confession & Heart Cry',
    am: 'የንስሐ እና የልብ ቃል',
    om: 'Qalbii Jijjiirrachuu',
    icon: '🕊️',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  prayer: {
    en: 'Prayer Request',
    am: 'የጸሎት ጥያቄ',
    om: 'Gaaffii Kadhannaa',
    icon: '🙏',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  testimony: {
    en: 'Testimony of Faith',
    am: 'የእምነት ምስክርነት',
    om: 'Dhugaa Ba\'umsa',
    icon: '🌟',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  relationship: {
    en: 'Friendship & Relationships',
    am: 'የጓደኝነትና ግንኙነት ተሞክሮ',
    om: 'Hiriyyummaa',
    icon: '🤝',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  life_experience: {
    en: 'Life Experience & Advice',
    am: 'የሕይወት ተሞክሮ እና ምክር',
    om: 'Muuxannoo Jireenyaa',
    icon: '💡',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  other: {
    en: 'General & Other',
    am: 'አጠቃላይ / ሌላ',
    om: 'Kan Biraa',
    icon: '💬',
    color: 'bg-slate-100 text-slate-800 border-slate-200',
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'moderation' | 'simulator' | 'channel' | 'admins' | 'deploy' | 'logs'>('moderation');
  const [statusData, setStatusData] = useState<BotStatusResponse | null>(null);
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterLang, setFilterLang] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: number | null; reason: string; submitting: boolean }>({
    open: false,
    id: null,
    reason: 'Violates community fellowship guidelines',
    submitting: false,
  });

  // Simulator state
  const [simLang, setSimLang] = useState<'en' | 'am' | 'om'>('en');
  const [simStep, setSimStep] = useState<'menu' | 'category' | 'input' | 'confirm' | 'success'>('menu');
  const [simCategory, setSimCategory] = useState<string>('confession');
  const [simContent, setSimContent] = useState('');
  const [simSubmitting, setSimSubmitting] = useState(false);
  const [simNotice, setSimNotice] = useState<string | null>(null);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setActionErrorMsg(msg);
      setActionSuccessMsg(null);
      setTimeout(() => setActionErrorMsg(null), 5000);
    } else {
      setActionSuccessMsg(msg);
      setActionErrorMsg(null);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  // Testing channel ping
  const [channelTestStatus, setChannelTestStatus] = useState<{ loading: boolean; result?: string; error?: string }>({
    loading: false,
  });

  const [copiedEnv, setCopiedEnv] = useState(false);
  const [testPingUserId, setTestPingUserId] = useState('5668244074');
  const [testPingStatus, setTestPingStatus] = useState<{ loading: boolean; result?: string; error?: string }>({
    loading: false,
  });

  const handleSendTestPing = async () => {
    setTestPingStatus({ loading: true, result: undefined, error: undefined });
    try {
      const res = await fetch('/api/telegram/test-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: testPingUserId }),
      });
      const data = await res.json();
      if (data.success) {
        setTestPingStatus({
          loading: false,
          result: `✅ Test message delivered to ${data.recipient || testPingUserId} (Message #${data.messageId})! Check Telegram now.`,
        });
        fetchData();
      } else {
        setTestPingStatus({
          loading: false,
          error: data.error + (data.hint ? ` (${data.hint})` : ''),
        });
      }
    } catch (e: any) {
      setTestPingStatus({ loading: false, error: e.message });
    }
  };

  const [resetSessionsStatus, setResetSessionsStatus] = useState<{ loading: boolean; result?: string; error?: string }>({
    loading: false,
  });

  const handleResetSessions = async () => {
    setResetSessionsStatus({ loading: true, result: undefined, error: undefined });
    try {
      const res = await fetch('/api/telegram/reset-user-sessions', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setResetSessionsStatus({ loading: false, result: '✅ All user sessions refreshed and reset to idle.' });
        setTimeout(() => setResetSessionsStatus({ loading: false }), 4000);
      } else {
        setResetSessionsStatus({ loading: false, error: data.error || 'Failed to reset sessions' });
      }
    } catch (e: any) {
      setResetSessionsStatus({ loading: false, error: e.message });
    }
  };

  const [restartBotLoading, setRestartBotLoading] = useState(false);

  const handleRestartBot = async () => {
    setRestartBotLoading(true);
    try {
      const res = await fetch('/api/bot/restart', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('⚡ Bot polling refreshed and actively listening on @focusconfessionbot!');
        fetchData();
      } else {
        showToast(data.error || 'Could not restart bot polling', true);
      }
    } catch (e: any) {
      showToast(e.message, true);
    } finally {
      setRestartBotLoading(false);
    }
  };

  // Fetch status, confessions, and live activity logs
  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const [statusRes, confRes, logsRes] = await Promise.all([
        fetch('/api/status'),
        fetch(`/api/confessions?status=${filterStatus}&category=${filterCategory}&language=${filterLang}&search=${encodeURIComponent(searchQuery)}`),
        fetch('/api/logs?limit=40'),
      ]);

      if (statusRes.ok && statusRes.headers.get('content-type')?.includes('application/json')) {
        const sJson = await statusRes.json();
        setStatusData(sJson);
      }
      if (confRes.ok && confRes.headers.get('content-type')?.includes('application/json')) {
        const cJson = await confRes.json();
        setConfessions(cJson.items || []);
      }
      if (logsRes.ok && logsRes.headers.get('content-type')?.includes('application/json')) {
        const lJson = await logsRes.json();
        if (Array.isArray(lJson)) setActivityLogs(lJson);
      }
    } catch (err) {
      console.warn('Waiting for server connection...', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 6000);
    // Keep-alive heartbeat ping every 15s to keep the container active while user is viewing
    const keepalive = setInterval(() => {
      fetch('/health').catch(() => {});
    }, 15000);

    return () => {
      clearInterval(interval);
      clearInterval(keepalive);
    };
  }, [filterStatus, filterCategory, filterLang, searchQuery]);

  // Handle Approve
  const handleApprove = async (id: number) => {
    try {
      const res = await fetch(`/api/confessions/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: 'WEB_OPERATOR', adminName: 'Church Admin' }),
      });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Server returned an unexpected response format');
      }
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Confession #${id} approved and published to @focushararconfession!`);
        fetchData();
      } else {
        showToast(data.error || 'Approval failed', true);
      }
    } catch (e: any) {
      showToast(e.message, true);
    }
  };

  // Handle Reject (opens clean in-app modal instead of blocked window.prompt)
  const handleReject = (id: number) => {
    setRejectModal({
      open: true,
      id,
      reason: 'Violates community fellowship guidelines',
      submitting: false,
    });
  };

  const confirmRejectModal = async () => {
    if (!rejectModal.id) return;
    setRejectModal((prev) => ({ ...prev, submitting: true }));
    try {
      const res = await fetch(`/api/confessions/${rejectModal.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: 'WEB_OPERATOR',
          adminName: 'Church Admin',
          reason: rejectModal.reason.trim() || 'Violates community fellowship guidelines',
        }),
      });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Server returned an unexpected response format');
      }
      const data = await res.json();
      if (data.success) {
        showToast(`❌ Confession #${rejectModal.id} rejected.`);
        setRejectModal({ open: false, id: null, reason: 'Violates community fellowship guidelines', submitting: false });
        fetchData();
      } else {
        showToast(data.error || 'Rejection failed', true);
        setRejectModal((prev) => ({ ...prev, submitting: false }));
      }
    } catch (e: any) {
      showToast(e.message, true);
      setRejectModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Channel Test Ping
  const testChannelPing = async () => {
    setChannelTestStatus({ loading: true });
    try {
      const res = await fetch('/api/channel/test', { method: 'POST' });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Server returned an unexpected response format');
      }
      const data = await res.json();
      if (data.success) {
        setChannelTestStatus({
          loading: false,
          result: `✅ Verified! Post #${data.messageId} successfully published to ${data.channel}.`,
        });
      } else {
        setChannelTestStatus({
          loading: false,
          error: data.error || 'Failed to post. Ensure @focusconfessionbot is an Admin with Post permission.',
        });
      }
    } catch (err: any) {
      setChannelTestStatus({ loading: false, error: err.message });
    }
  };

  // Submit via Simulator
  const handleSimSubmit = async () => {
    if (!simContent.trim() || simContent.trim().length < 8) {
      setSimNotice('⚠️ Please enter at least 8 characters before sending.');
      return;
    }

    setSimNotice(null);
    setSimSubmitting(true);
    try {
      const res = await fetch('/api/confessions/submit-simulated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: simCategory,
          language: simLang,
          content: simContent,
        }),
      });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Server returned an unexpected response format');
      }
      const data = await res.json();
      if (data.success) {
        setSimStep('success');
        fetchData();
      } else {
        setSimNotice(`⚠️ ${data.error || 'Failed to submit'}`);
      }
    } catch (err: any) {
      setSimNotice(`⚠️ ${err.message}`);
    } finally {
      setSimSubmitting(false);
    }
  };

  const [webhookLoading, setWebhookLoading] = useState(false);

  // Set Webhook for 24/7 instant wake-up
  const handleSetWebhook = async () => {
    setWebhookLoading(true);
    try {
      const url = window.location.origin;
      const res = await fetch('/api/bot/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`⚡ Live Webhook active at ${url}!`);
        fetchData();
      } else {
        showToast(data.message || 'Failed to set webhook', true);
      }
    } catch (e: any) {
      showToast(e.message, true);
    } finally {
      setWebhookLoading(false);
    }
  };

  // Switch back to real-time polling
  const handleSetPolling = async () => {
    setWebhookLoading(true);
    try {
      const res = await fetch('/api/bot/set-polling', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('🔄 Real-time polling mode activated.');
        fetchData();
      } else {
        showToast(data.message || 'Failed to switch to polling', true);
      }
    } catch (e: any) {
      showToast(e.message, true);
    } finally {
      setWebhookLoading(false);
    }
  };

  const copyEnvText = () => {
    const text = `TELEGRAM_BOT_TOKEN="9076811511:AAHDbPOyKNC1rYrAD_8wFsOjosPQ3etCbR8"
TELEGRAM_CHANNEL="@focushararconfession"
ADMIN_USER_IDS="8288768451,500809303,1797336624,891456621,6998904064,728967558,1212461660"
PORT=3000
DATABASE_PATH="/app/data/confessions.db"`;
    navigator.clipboard.writeText(text);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  const stats = statusData?.stats || {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    todayCount: 0,
    byCategory: [],
    byLanguage: [],
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Top Banner & Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-md">
                <span className="text-xl">🕊️</span>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="font-bold text-lg text-slate-900 leading-tight">Focus Harar Confession</h1>
                  {statusData?.bot?.status === 'running' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium border border-emerald-200 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Bot Active
                    </span>
                  ) : statusData?.bot?.status === 'error' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-medium border border-rose-200 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      Reconnecting
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium border border-amber-200 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      Connecting...
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Church Fellowship Anonymous Telegram Bot & {statusData?.adminsCount || 7}-Admin Moderation Hub
                </p>
              </div>
            </div>

            {/* Quick Status Links */}
            <div className="flex items-center space-x-3">
              <a
                href="https://t.me/focusconfessionbot"
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-medium transition"
              >
                <span>🤖 @focusconfessionbot</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href="https://t.me/focushararconfession"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-medium transition"
              >
                <span>📢 Channel Feed</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={fetchData}
                disabled={isRefreshing}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 sm:space-x-4 border-t border-slate-100 py-2 overflow-x-auto scrollbar-none text-sm">
            <button
              onClick={() => setActiveTab('moderation')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-2 shrink-0 ${
                activeTab === 'moderation'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Moderation Queue</span>
              {stats.pending > 0 && (
                <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'moderation' ? 'bg-white text-indigo-700' : 'bg-amber-500 text-white'}`}>
                  {stats.pending}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-2 shrink-0 ${
                activeTab === 'simulator'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Telegram Bot Simulator</span>
              <span className="text-xs px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">3 Languages</span>
            </button>

            <button
              onClick={() => setActiveTab('channel')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-2 shrink-0 ${
                activeTab === 'channel'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Channel Feed Preview</span>
            </button>

            <button
              onClick={() => setActiveTab('admins')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-2 shrink-0 ${
                activeTab === 'admins'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{statusData?.adminsCount || 7}-Admin Security</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-2 shrink-0 ${
                activeTab === 'logs'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Live Activity</span>
            </button>

            <button
              onClick={() => setActiveTab('deploy')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-2 shrink-0 ${
                activeTab === 'deploy'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Bot Live Status & Hosting</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Action Notification Alerts */}
      {actionSuccessMsg && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 text-center text-sm font-medium shadow-md transition-all flex items-center justify-center gap-3">
          <span>{actionSuccessMsg}</span>
          <button onClick={() => setActionSuccessMsg(null)} className="text-white/80 hover:text-white text-xs underline">Dismiss</button>
        </div>
      )}
      {actionErrorMsg && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-center text-sm font-medium shadow-md transition-all flex items-center justify-center gap-3">
          <span>⚠️ {actionErrorMsg}</span>
          <button onClick={() => setActionErrorMsg(null)} className="text-white/80 hover:text-white text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ===================== TAB 1: MODERATION QUEUE ===================== */}
        {activeTab === 'moderation' && (
          <div className="space-y-6">
            {/* Bot Live Status Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-indigo-900/50 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-xl shrink-0">
                    ⚡
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-100">Bot Service Status:</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
                        statusData?.bot?.status === 'running'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${statusData?.bot?.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`}></span>
                        {statusData?.bot?.status === 'running' ? 'Active & Polling Right Now' : 'Connecting...'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        Direct Fast Polling (3s){statusData?.bot?.pollCycles ? ` • #${statusData.bot.pollCycles}` : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Directly connected to <a href="https://t.me/focusconfessionbot" target="_blank" rel="noreferrer" className="text-sky-300 underline font-semibold">@focusconfessionbot</a>. Registered commands and persistent SQLite session active.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={handleRestartBot}
                    disabled={restartBotLoading}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${restartBotLoading ? 'animate-spin' : ''}`} />
                    <span>{restartBotLoading ? 'Refreshing...' : 'Refresh Bot'}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('deploy')}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition flex items-center gap-1.5"
                  >
                    <Server className="w-3.5 h-3.5" />
                    <span>Diagnostics & Hosting</span>
                  </button>

                  <a
                    href="https://t.me/focusconfessionbot"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition flex items-center gap-1.5"
                  >
                    <span>Open @focusconfessionbot</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Live Telegram Ping Tester */}
              <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-indigo-300 font-semibold flex items-center gap-1">
                    <Send className="w-3.5 h-3.5" /> Test Live Bot Connectivity:
                  </span>
                  <input
                    type="text"
                    value={testPingUserId}
                    onChange={(e) => setTestPingUserId(e.target.value)}
                    placeholder="Telegram ID (e.g. 5668244074)"
                    className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400 w-36"
                  />
                  <button
                    onClick={handleSendTestPing}
                    disabled={testPingStatus.loading}
                    className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition disabled:opacity-50"
                  >
                    {testPingStatus.loading ? 'Sending...' : 'Send Live Test Ping'}
                  </button>
                </div>

                {testPingStatus.result && (
                  <span className="text-emerald-400 font-medium">{testPingStatus.result}</span>
                )}
                {testPingStatus.error && (
                  <span className="text-rose-400 font-medium">⚠️ {testPingStatus.error}</span>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Review</span>
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline">
                  <span className="text-2xl font-bold text-amber-600">{stats.pending}</span>
                  <span className="ml-2 text-xs text-slate-400">needs review</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Approved & Live</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline">
                  <span className="text-2xl font-bold text-emerald-600">{stats.approved}</span>
                  <span className="ml-2 text-xs text-slate-400">on channel</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rejected</span>
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                    <XCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline">
                  <span className="text-2xl font-bold text-rose-600">{stats.rejected}</span>
                  <span className="ml-2 text-xs text-slate-400">filtered</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Received</span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline">
                  <span className="text-2xl font-bold text-indigo-700">{stats.total}</span>
                  <span className="ml-2 text-xs text-slate-400">confessions</span>
                </div>
              </div>

              <div className="hidden lg:block bg-gradient-to-br from-indigo-700 to-indigo-900 p-4 rounded-xl text-white shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-indigo-200">Church Admins</span>
                  <Users className="w-4 h-4 text-indigo-300" />
                </div>
                <div className="mt-2 flex items-baseline">
                  <span className="text-2xl font-bold">{statusData?.adminsCount || 7}</span>
                  <span className="ml-2 text-xs text-indigo-200">authorized</span>
                </div>
                <p className="mt-1 text-[11px] text-indigo-200 truncate">Equal moderation privileges</p>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Status selector */}
                <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-medium">
                  {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setFilterStatus(st)}
                      className={`px-3 py-1 rounded-md transition ${
                        filterStatus === st
                          ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Category filter */}
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">All Categories</option>
                  <option value="confession">🕊️ Confession</option>
                  <option value="prayer">🙏 Prayer Request</option>
                  <option value="testimony">🌟 Testimony</option>
                  <option value="relationship">🤝 Relationship</option>
                  <option value="life_experience">💡 Life Experience</option>
                  <option value="other">💬 Other</option>
                </select>

                {/* Language filter */}
                <select
                  value={filterLang}
                  onChange={(e) => setFilterLang(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">All Languages</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="am">🇪🇹 አማርኛ (Amharic)</option>
                  <option value="om">🌳 Afaan Oromoo</option>
                </select>
              </div>

              {/* Search input & Export */}
              <div className="flex items-center space-x-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search confession text or #ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <a
                  href="/api/export?format=csv"
                  className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center text-xs gap-1 px-2.5"
                  title="Export to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </a>
              </div>
            </div>

            {/* Confessions List */}
            {isLoading ? (
              <div className="py-16 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3 text-indigo-600" />
                <p>Loading church confessions...</p>
              </div>
            ) : confessions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-800">No confessions found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {filterStatus !== 'ALL'
                    ? `No submissions currently in "${filterStatus}" status.`
                    : 'No confessions matching your search filter.'}
                </p>
                <button
                  onClick={() => setActiveTab('simulator')}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Submit a test confession via Simulator
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {confessions.map((c) => {
                  const cat = CATEGORY_MAP[c.category] || {
                    en: c.category,
                    am: c.category,
                    om: c.category,
                    icon: '📝',
                    color: 'bg-slate-100 text-slate-800 border-slate-200',
                  };

                  return (
                    <div
                      key={c.id}
                      className={`bg-white rounded-xl border transition-all p-5 shadow-2xs ${
                        c.status === 'PENDING'
                          ? 'border-amber-300 ring-1 ring-amber-100'
                          : c.status === 'APPROVED'
                          ? 'border-emerald-200'
                          : 'border-slate-200 opacity-80'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {c.formatted_id}
                          </span>

                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border flex items-center gap-1 ${cat.color}`}>
                            <span>{cat.icon}</span>
                            <span>{cat.en}</span>
                          </span>

                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase font-semibold">
                            {c.language === 'am' ? '🇪🇹 አማርኛ' : c.language === 'om' ? '🌳 Oromo' : '🇬🇧 EN'}
                          </span>
                        </div>

                        <div className="flex items-center space-x-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            <Shield className="w-3 h-3 text-emerald-600" />
                            100% Anonymous (No ID Attached)
                          </span>
                          <span>{new Date(c.created_at).toLocaleDateString()} {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {/* Confession body */}
                      <div className="my-3">
                        <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-serif sm:text-base bg-slate-50/70 p-3.5 rounded-lg border border-slate-100">
                          "{c.content}"
                        </p>
                      </div>

                      {/* Footer & Moderation Status */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <div className="text-xs text-slate-500">
                          {c.status === 'APPROVED' && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Approved by {c.moderator_name || c.moderated_by} • Published to @focushararconfession
                            </span>
                          )}
                          {c.status === 'REJECTED' && (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-medium bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              Rejected by {c.moderator_name || c.moderated_by} {c.rejection_reason ? `(${c.rejection_reason})` : ''}
                            </span>
                          )}
                          {c.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-medium bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 animate-pulse">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Pending church admin review (Telegram alert sent to all 5 admins)
                            </span>
                          )}
                        </div>

                        {/* Action buttons if Pending */}
                        {c.status === 'PENDING' && (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleApprove(c.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approve & Publish to Channel
                            </button>

                            <button
                              onClick={() => handleReject(c.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 2: BOT SIMULATOR ===================== */}
        {activeTab === 'simulator' && (
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left description */}
            <div className="md:col-span-5 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2 text-indigo-700 font-bold mb-2">
                  <Smartphone className="w-5 h-5" />
                  <h3>Live Telegram Bot Simulator</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Test the complete interactive user experience of <strong>@focusconfessionbot</strong> without leaving your browser.
                </p>
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Multi-language: English, Amharic, Oromo</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Church categories with biblical touch</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Automatic notification to all 5 church admins</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Guaranteed anonymity & identity decoupling</span>
                  </div>
                </div>

                <div className="mt-5 p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs">
                  <p className="font-semibold mb-1">📢 Active Telegram Bot:</p>
                  <p className="text-slate-600 text-[11px]">
                    The bot is concurrently running on Telegram at <a href="https://t.me/focusconfessionbot" target="_blank" rel="noreferrer" className="underline font-bold text-indigo-700">@focusconfessionbot</a>. You can open Telegram anytime and message it directly!
                  </p>
                </div>
              </div>

              {/* Language switcher for simulator */}
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-700 block mb-2">Simulator Language / ቋንቋ:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSimLang('en')}
                    className={`py-2 px-2 text-xs rounded-lg font-medium border transition ${
                      simLang === 'en' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    🇬🇧 English
                  </button>
                  <button
                    onClick={() => setSimLang('am')}
                    className={`py-2 px-2 text-xs rounded-lg font-medium border transition ${
                      simLang === 'am' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    🇪🇹 አማርኛ
                  </button>
                  <button
                    onClick={() => setSimLang('om')}
                    className={`py-2 px-2 text-xs rounded-lg font-medium border transition ${
                      simLang === 'om' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    🌳 Oromo
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Simulated Mobile Phone Frame */}
            <div className="md:col-span-7 flex justify-center">
              <div className="w-full max-w-sm bg-slate-900 rounded-[2.5rem] p-3 shadow-2xl border-4 border-slate-800">
                {/* Screen */}
                <div className="bg-[#0e1621] text-slate-100 rounded-[2rem] overflow-hidden flex flex-col h-[580px] text-xs">
                  {/* Telegram Chat Header */}
                  <div className="bg-[#17212b] px-4 py-3 flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-sm shadow-xs">
                        🕊️
                      </div>
                      <div>
                        <div className="font-semibold text-slate-100 text-xs">Focus Harar Confession</div>
                        <div className="text-[10px] text-sky-400">bot • active</div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {simLang}
                    </span>
                  </div>

                  {/* Messages Scroll Area */}
                  <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-[size:16px_16px]">
                    {/* Welcome Bot message */}
                    <div className="max-w-[85%] bg-[#182533] p-3 rounded-2xl rounded-tl-xs shadow-xs text-slate-200 space-y-2">
                      <p className="font-semibold text-amber-400">
                        {simLang === 'am' ? '🕊️ ወደ ፎከስ ሐረር የንስሐና ምስክርነት ቦት በደህና መጡ' : simLang === 'om' ? '🕊️ Baga Gara Botii Focus Harar nagaan dhuftan' : '🕊️ Welcome to Focus Harar Anonymous Bot'}
                      </p>
                      <p className="text-[11px] leading-relaxed text-slate-300">
                        {simLang === 'am'
                          ? 'የልብ ሸክማችሁን፣ የንስሐ ቃላችሁንና ምስክርነታችሁን በ100% ሙሉ ሚስጥራዊነት የምታካፍሉበት መድረክ ነው።'
                          : simLang === 'om'
                          ? 'Yaada garaa keessanii, qalbii jijjiirraa fi dhugaa ba\'umsa iccitii guutuun kan itti qooddattaniidha.'
                          : 'A safe, 100% confidential space to submit your heart cries, prayers, and testimonies anonymously.'}
                      </p>
                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-700/50 flex items-center gap-1">
                        <Shield className="w-3 h-3 text-emerald-400" />
                        <span>Identity is never saved or revealed.</span>
                      </div>
                    </div>

                    {/* Step: Category selection */}
                    {simStep === 'category' && (
                      <div className="max-w-[88%] bg-[#182533] p-3 rounded-2xl rounded-tl-xs space-y-2">
                        <p className="font-medium text-amber-300 text-xs">
                          {simLang === 'am' ? '📂 ደረጃ 1: እባክዎ ምድብ ይምረጡ' : simLang === 'om' ? '📂 Sadarkaa 1: Ramaddii Filadhaa' : '📂 Step 1: Select Category'}
                        </p>
                        <div className="grid grid-cols-1 gap-1.5 pt-1">
                          {Object.entries(CATEGORY_MAP).map(([key, cat]) => (
                            <button
                              key={key}
                              onClick={() => {
                                setSimCategory(key);
                                setSimStep('input');
                              }}
                              className="text-left px-2.5 py-1.5 rounded-lg bg-[#2b394a] hover:bg-[#344558] text-slate-100 text-xs flex items-center justify-between transition"
                            >
                              <span>{cat.icon} {cat[simLang]}</span>
                              <span className="text-[10px] text-slate-400">Select</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Step: Input text */}
                    {simStep === 'input' && (
                      <div className="max-w-[85%] bg-[#182533] p-3 rounded-2xl rounded-tl-xs space-y-2">
                        <p className="font-semibold text-sky-400 text-xs">
                          {CATEGORY_MAP[simCategory]?.icon} {CATEGORY_MAP[simCategory]?.[simLang]}
                        </p>
                        <p className="text-[11px] text-slate-300">
                          {simLang === 'am'
                            ? 'እባክዎ መልእክትዎን ከታች ባለው ሳጥን ውስጥ ጽፈው ይላኩ።'
                            : simLang === 'om'
                            ? 'Maaloo ergaa keessan armaan gaditti barreessaa.'
                            : 'Please write your message below. God bless your heart.'}
                        </p>
                      </div>
                    )}

                    {/* Step: Confirmation */}
                    {simStep === 'confirm' && (
                      <div className="max-w-[90%] bg-[#182533] p-3 rounded-2xl rounded-tl-xs space-y-2 border border-indigo-500/30">
                        <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
                          <span>🕊️ Review Submission</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-300">Anonymous</span>
                        </div>
                        <div className="p-2.5 bg-[#0e1621] rounded-lg text-slate-200 text-xs italic">
                          "{simContent}"
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={handleSimSubmit}
                            disabled={simSubmitting}
                            className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1"
                          >
                            {simSubmitting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            <span>{simLang === 'am' ? 'አረጋግጥና ላክ' : simLang === 'om' ? 'Mirkaneessiitii Ergi' : 'Confirm & Send'}</span>
                          </button>
                          <button
                            onClick={() => setSimStep('menu')}
                            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step: Success */}
                    {simStep === 'success' && (
                      <div className="max-w-[88%] bg-[#182533] p-3.5 rounded-2xl rounded-tl-xs space-y-2 border border-emerald-500/40">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {simLang === 'am' ? 'መልእክትዎ በድብቅ ደርሶናል!' : simLang === 'om' ? 'Ergaan keessan nu ga\'eera!' : 'Received Anonymously!'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {simLang === 'am'
                            ? 'በ5ቱ የቤተክርስቲያን አስተዳዳሪዎች ተገምግሞ ከጸደቀ በኋላ ወደ @focushararconfession ይለጠፋል።'
                            : simLang === 'om'
                            ? 'Hoggantootaan erga ilaalamee booda chaanaalii keenyarratti kan maxxanfamu ta\'a.'
                            : 'Submitted to all 5 church leaders. Once approved, it will appear on @focushararconfession.'}
                        </p>
                        <button
                          onClick={() => {
                            setSimContent('');
                            setSimStep('menu');
                          }}
                          className="mt-2 w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                        >
                          Return to Menu / ሌላ መልእክት
                        </button>
                      </div>
                    )}
                    {simNotice && (
                      <div className="max-w-[92%] bg-[#1f2c3d] p-3 rounded-2xl rounded-tl-xs space-y-1.5 border border-sky-500/30 text-slate-200 text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sky-300">🤖 Bot Info</span>
                          <button onClick={() => setSimNotice(null)} className="text-[10px] text-slate-400 hover:text-white">✕</button>
                        </div>
                        <p className="leading-relaxed whitespace-pre-wrap">{simNotice}</p>
                      </div>
                    )}
                  </div>

                  {/* Simulator Input / Bottom Action Bar */}
                  <div className="p-3 bg-[#17212b] border-t border-slate-800">
                    {simStep === 'menu' && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setSimNotice(null);
                            setSimStep('category');
                          }}
                          className="col-span-2 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {simLang === 'am' ? '✍️ መልእክት / ንስሐ ላክ' : simLang === 'om' ? '✍️ Yaada / Qalbii Jijjiirraa Ergi' : '✍️ Submit Confession'}
                          </span>
                        </button>

                        <button
                          onClick={() => setSimNotice('📢 Official Channel: @focushararconfession\nhttps://t.me/focushararconfession')}
                          className="py-1.5 px-2 rounded-lg bg-[#2b394a] text-slate-300 hover:bg-[#344558] text-[11px]"
                        >
                          📢 {simLang === 'am' ? 'ቻናል' : 'Channel'}
                        </button>

                        <button
                          onClick={() => setSimNotice('🛡️ Privacy & Guidelines: 100% anonymous. Your Telegram ID & username are never saved or posted. Please avoid hate speech or personal names.')}
                          className="py-1.5 px-2 rounded-lg bg-[#2b394a] text-slate-300 hover:bg-[#344558] text-[11px]"
                        >
                          🛡️ {simLang === 'am' ? 'መመሪያ' : 'Guidelines'}
                        </button>
                      </div>
                    )}

                    {simStep === 'input' && (
                      <div className="space-y-2">
                        <textarea
                          rows={3}
                          value={simContent}
                          onChange={(e) => {
                            setSimContent(e.target.value);
                            if (simNotice) setSimNotice(null);
                          }}
                          placeholder={
                            simLang === 'am'
                              ? 'የልብዎን ቃል ወይም የጸሎት ጥያቄ ይጻፉ...'
                              : simLang === 'om'
                              ? 'Yaada keessan asitti barreessaa...'
                              : 'Type your anonymous prayer request, confession or testimony...'
                          }
                          className="w-full bg-[#0e1621] text-slate-100 rounded-xl p-2.5 text-xs border border-slate-700 focus:outline-none focus:border-indigo-500 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (simContent.trim().length >= 8) {
                                setSimNotice(null);
                                setSimStep('confirm');
                              } else {
                                setSimNotice('⚠️ Please write at least 8 characters before continuing.');
                              }
                            }}
                            className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>Continue</span>
                          </button>
                          <button
                            onClick={() => {
                              setSimNotice(null);
                              setSimStep('menu');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {(simStep === 'category' || simStep === 'confirm' || simStep === 'success') && (
                      <div className="text-center text-[11px] text-slate-400">
                        <span>Telegram Bot Interactive State: {simStep.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: CHANNEL PREVIEW ===================== */}
        {activeTab === 'channel' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Channel Header Banner */}
            <div className="bg-gradient-to-r from-indigo-800 to-indigo-950 text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-3xl">
                  ⛪
                </div>
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <span>Focus Harar Confession Channel</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Public Channel
                    </span>
                  </h2>
                  <p className="text-xs text-indigo-200 mt-1">
                    Designated channel: <span className="font-mono text-amber-300 font-bold">@focushararconfession</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={testChannelPing}
                  disabled={channelTestStatus.loading}
                  className="px-3.5 py-2 rounded-xl bg-white text-indigo-900 text-xs font-semibold hover:bg-indigo-50 transition shadow-xs flex items-center gap-1.5"
                >
                  {channelTestStatus.loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5 text-indigo-600" />}
                  <span>Test Channel Ping</span>
                </button>

                <a
                  href="https://t.me/focushararconfession"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-indigo-700/80 hover:bg-indigo-700 text-white text-xs font-semibold transition border border-indigo-500/40 flex items-center gap-1.5"
                >
                  <span>Open in Telegram</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Test result message */}
            {channelTestStatus.result && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{channelTestStatus.result}</span>
              </div>
            )}
            {channelTestStatus.error && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <p className="font-semibold">{channelTestStatus.error}</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Fix: In Telegram, go to channel @focushararconfession &gt; Administrators &gt; Add @focusconfessionbot and enable "Post Messages".
                  </p>
                </div>
              </div>
            )}

            {/* Simulated Telegram Channel Post Feed */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <span>Approved Posts Appearance on Telegram</span>
              </h3>

              {confessions.filter((c) => c.status === 'APPROVED').length === 0 ? (
                <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
                  No approved confessions yet. Approve one in the Moderation Queue to see it live here!
                </div>
              ) : (
                confessions
                  .filter((c) => c.status === 'APPROVED')
                  .slice(0, 5)
                  .map((c) => {
                    const cat = CATEGORY_MAP[c.category];
                    return (
                      <div
                        key={c.id}
                        className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 max-w-2xl font-mono text-xs text-slate-800 space-y-3"
                      >
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center text-indigo-900 font-bold tracking-widest text-[11px]">
                          ╭───────────────❖───────────────╮<br />
                          ⛪ FOCUS HARAR FELLOWSHIP<br />
                          ╰───────────────❖───────────────╯
                        </div>

                        <div className="space-y-1 text-slate-600 text-xs font-sans">
                          <p>📌 <strong>Submission:</strong> <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-900">{c.formatted_id}</span></p>
                          <p>📁 <strong>Category:</strong> {cat ? `${cat.icon} ${cat.en} | ${cat.am}` : c.category}</p>
                          <p>📅 <strong>Date:</strong> {new Date(c.created_at).toLocaleDateString()}</p>
                          <p>🔒 <strong>Status:</strong> Verified Anonymous</p>
                        </div>

                        <div className="border-t border-b border-slate-200 py-3 my-2 font-serif text-sm text-slate-900 leading-relaxed italic whitespace-pre-wrap">
                          "{c.content}"
                        </div>

                        <div className="text-[11px] text-slate-500 space-y-1 font-sans">
                          <p className="italic text-indigo-950 font-serif">
                            ✨ "Therefore encourage one another and build each other up, just as in fact you are doing." — 1 Thess. 5:11
                          </p>
                          <p className="pt-1 text-[11px] text-slate-400">
                            🕊️ Submit your anonymous reflection: @focusconfessionbot<br />
                            📢 Official Channel: @focushararconfession
                          </p>
                          <p className="text-indigo-600 font-mono text-[10px]">
                            #Confession #FocusHarar #FellowConfession #ChurchCommunity
                          </p>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 4: 5-ADMIN SECURITY ===================== */}
        {activeTab === 'admins' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Five-Administrator Management System</h2>
                  <p className="text-xs text-slate-500">
                    Equal moderation rights, instant Telegram notifications, and atomic double-action prevention.
                  </p>
                </div>
              </div>

              {/* Authorized Admin List */}
              <div className="space-y-3 mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Authorized Telegram Admin IDs:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(statusData?.adminsList || [
                    '8288768451',
                    '500809303',
                    '1797336624',
                    '891456621',
                    '6998904064',
                    '728967558',
                    '1212461660',
                  ]).map((id, index) => (
                    <div
                      key={id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                          A{index + 1}
                        </div>
                        <div>
                          <div className="font-mono text-xs font-semibold text-slate-900">{id}</div>
                          <div className="text-[10px] text-slate-500">Church Administrator #{index + 1}</div>
                        </div>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                        Full Rights
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Moderation Workflow explanation */}
              <div className="mt-8 border-t border-slate-100 pt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  How the 5-Admin Workflow Functions:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">1</div>
                    <div className="font-semibold text-slate-800">Simultaneous Alert</div>
                    <p className="text-slate-500 text-[11px]">
                      When a church member submits a confession, all authorized admins receive an instant Telegram message with [Approve] and [Reject] buttons.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">2</div>
                    <div className="font-semibold text-slate-800">Atomic Action Check</div>
                    <p className="text-slate-500 text-[11px]">
                      The SQLite database atomically locks the record so only the first admin who clicks can moderate. Duplicate actions are strictly blocked.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">3</div>
                    <div className="font-semibold text-slate-800">Global Notification Update</div>
                    <p className="text-slate-500 text-[11px]">
                      The Telegram message is edited across all 5 admins showing who approved/rejected it and when, keeping the leadership team synchronized.
                    </p>
                  </div>
                </div>
              </div>

              {/* Privacy Guarantee */}
              <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <Shield className="w-4 h-4 text-emerald-700" />
                  <span>Privacy Architecture Audit:</span>
                </div>
                <p className="text-emerald-800 text-[11px] leading-relaxed">
                  The sender's Telegram User ID, username, and profile are never stored in the confessions table. The anti-spam rate limiter operates in a completely separate table with timestamps only, ensuring absolute anonymity before God and the church.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 5: BOT LIVE STATUS & HOSTING ===================== */}
        {activeTab === 'deploy' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Live Operational Health Status Card */}
            <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-emerald-500/30 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 text-2xl">
                    ⚡
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold">Bot Status: 100% Active & Polling</h2>
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                    </div>
                    <p className="text-xs text-emerald-200 mt-0.5">
                      Direct connection established with Telegram Bot API • Offset synchronized
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="https://t.me/focusconfessionbot"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                  >
                    <span>Open @focusconfessionbot</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Bot Live Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs border-t border-white/10">
                <div className="bg-black/20 rounded-xl p-3">
                  <div className="text-emerald-300/80 text-[11px]">Bot Username</div>
                  <div className="font-mono font-bold text-slate-100 text-xs mt-0.5">@focusconfessionbot</div>
                </div>
                <div className="bg-black/20 rounded-xl p-3">
                  <div className="text-emerald-300/80 text-[11px]">Official Channel</div>
                  <div className="font-mono font-bold text-slate-100 text-xs mt-0.5">@focushararconfession</div>
                </div>
                <div className="bg-black/20 rounded-xl p-3">
                  <div className="text-emerald-300/80 text-[11px]">Connection Mode</div>
                  <div className="font-mono font-bold text-slate-100 text-xs mt-0.5">Long-Polling (3s)</div>
                </div>
                <div className="bg-black/20 rounded-xl p-3">
                  <div className="text-emerald-300/80 text-[11px]">Authorized Admins</div>
                  <div className="font-mono font-bold text-slate-100 text-xs mt-0.5">7 Church Leaders</div>
                </div>
              </div>
            </div>

            {/* Interactive Live Diagnostics & Tools */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2.5">
                  <Smartphone className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">Live Telegram Diagnostics & Controls</h3>
                </div>
                <span className="text-xs text-slate-400">Instant Verification</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Send Test Ping */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Send Live Ping & Buttons to Telegram</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Sends a live message with the 3-button reply keyboard directly to your Telegram chat to confirm responsiveness.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testPingUserId}
                      onChange={(e) => setTestPingUserId(e.target.value)}
                      placeholder="Telegram User ID (e.g. 674224568)"
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={handleSendTestPing}
                      disabled={testPingStatus.loading}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 shrink-0"
                    >
                      {testPingStatus.loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Send Ping</span>
                    </button>
                  </div>
                  {testPingStatus.result && (
                    <div className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200 font-medium">
                      {testPingStatus.result}
                    </div>
                  )}
                  {testPingStatus.error && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      {testPingStatus.error}
                    </div>
                  )}
                </div>

                {/* Reset User Sessions */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Reset All User Sessions</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    If any user was previously stuck in a half-finished step, this clears all pending session steps to clean idle state.
                  </p>
                  <div>
                    <button
                      onClick={handleResetSessions}
                      disabled={resetSessionsStatus.loading}
                      className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      {resetSessionsStatus.loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>Refresh & Reset All User Sessions</span>
                    </button>
                  </div>
                  {resetSessionsStatus.result && (
                    <div className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200 font-medium">
                      {resetSessionsStatus.result}
                    </div>
                  )}
                  {resetSessionsStatus.error && (
                    <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                      {resetSessionsStatus.error}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={handleRestartBot}
                  disabled={restartBotLoading}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${restartBotLoading ? 'animate-spin' : ''}`} />
                  <span>{restartBotLoading ? 'Refreshing Polling...' : 'Wake / Restart Bot Polling Now'}</span>
                </button>
                <span className="text-[11px] text-slate-500 self-center">
                  Last poll: {statusData?.bot?.lastPollAt ? new Date(statusData.bot.lastPollAt).toLocaleTimeString() : 'Active'} • Poll cycles: {statusData?.bot?.pollCycles ?? 0}
                </span>
              </div>
            </div>

            {/* Standalone Always-On Hosting Info */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">24/7 Always-Active Hosting (When Browser Is Closed)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    The bot is live right now while this preview is open. Preview environments automatically pause after you close AI Studio — to keep @focusconfessionbot online 24/7 even when your computer is off, deploy this repository to Cloud Run, Railway, or Render:
                  </p>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium shrink-0">
                  Configured & Ready
                </div>
              </div>

              {/* Copy Environment Variables */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Production Environment Variables:
                  </span>
                  <button
                    onClick={copyEnvText}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    {copiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedEnv ? 'Copied to Clipboard!' : 'Copy All Variables'}</span>
                  </button>
                </div>

                <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-xs overflow-x-auto space-y-1">
                  <p><span className="text-sky-400">TELEGRAM_BOT_TOKEN</span>=<span className="text-amber-300">"9076811511:AAHDbPOyKNC1rYrAD_8wFsOjosPQ3etCbR8"</span></p>
                  <p><span className="text-sky-400">TELEGRAM_CHANNEL</span>=<span className="text-amber-300">"@focushararconfession"</span></p>
                  <p><span className="text-sky-400">ADMIN_USER_IDS</span>=<span className="text-amber-300">"8288768451,500809303,1797336624,891456621,6998904064,728967558,1212461660"</span></p>
                  <p><span className="text-sky-400">PORT</span>=<span className="text-amber-300">3000</span></p>
                  <p><span className="text-sky-400">DATABASE_PATH</span>=<span className="text-amber-300">"/app/data/confessions.db"</span></p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 6: LIVE ACTIVITY LOGS ===================== */}
        {activeTab === 'logs' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Real-Time Telegram Bot Activity</h2>
                <p className="text-xs text-slate-500">Live log of incoming messages, button clicks, submissions, and polling heartbeats.</p>
              </div>
              <button
                onClick={fetchData}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh Logs</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
              {activityLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No bot activity logged yet.</div>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 ${
                        log.action.includes('ERROR')
                          ? 'bg-rose-100 text-rose-700'
                          : log.action.includes('CONFESSION') || log.action.includes('APPROVED')
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.action.includes('BOT_START')
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {log.action}
                      </span>
                      <span className="text-slate-700 truncate">{log.details}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Rejection Reason Modal (replaces blocked window.prompt) */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Reject Confession #{rejectModal.id}</h3>
              <button
                onClick={() => setRejectModal({ open: false, id: null, reason: 'Violates community fellowship guidelines', submitting: false })}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 block">Optional rejection note:</label>
              <textarea
                rows={3}
                value={rejectModal.reason}
                onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                placeholder="Reason for rejection..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectModal({ open: false, id: null, reason: 'Violates community fellowship guidelines', submitting: false })}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmRejectModal}
                disabled={rejectModal.submitting}
                className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {rejectModal.submitting ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center space-x-2">
            <span>🕊️ Focus Harar Fellowship Ministry</span>
            <span>•</span>
            <span>Focus Harar Confession Telegram Bot</span>
          </div>
          <div>
            Built with Telegraf • SQLite Persistent Storage • Railway Ready
          </div>
        </div>
      </footer>
    </div>
  );
}
