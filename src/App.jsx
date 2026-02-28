import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen, Clock, Coins, Trophy, ChevronRight, ChevronLeft,
  LogIn, LogOut, User, Star, RotateCcw, CheckCircle2, XCircle,
  AlertCircle, Zap, BarChart2, Calendar, Lock, PlayCircle,
  Copyright, Loader2, Home, BookMarked, Target
} from 'lucide-react';
import { db, auth } from './firebase';
import {
  doc, getDoc, updateDoc, collection, getDocs, addDoc,
  query, where, orderBy, limit, increment
} from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CREDIT_COST = 1;

const SUBTESTS = [
  { id: 'pu',  name: 'Penalaran Umum',                  questions: 30, time: 30,  icon: '🧠', group: 'TPS' },
  { id: 'ppu', name: 'Pengetahuan & Pemahaman Umum',    questions: 20, time: 15,  icon: '📚', group: 'TPS' },
  { id: 'pbm', name: 'Pemahaman Bacaan & Menulis',      questions: 20, time: 25,  icon: '✍️', group: 'TPS' },
  { id: 'pk',  name: 'Pengetahuan Kuantitatif',         questions: 20, time: 20,  icon: '🔢', group: 'TPS' },
  { id: 'lbi', name: 'Literasi Bahasa Indonesia',       questions: 30, time: 45,  icon: '🇮🇩', group: 'Literasi' },
  { id: 'lbe', name: 'Literasi Bahasa Inggris',         questions: 20, time: 30,  icon: '🌐', group: 'Literasi' },
  { id: 'pm',  name: 'Penalaran Matematika',            questions: 20, time: 30,  icon: '📐', group: 'Literasi' },
];

const GROUP_COLORS = {
  TPS:      { bg: 'from-blue-600 to-indigo-700',    badge: 'bg-blue-100 text-blue-700',    ring: 'ring-blue-400' },
  Literasi: { bg: 'from-orange-500 to-rose-600',    badge: 'bg-orange-100 text-orange-700', ring: 'ring-orange-400' },
};

const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

// ─── SCORE CALC ───────────────────────────────────────────────────────────────
const calcPracticeScore = (answers, questions, subtestId) => {
  let correct = 0, total = questions.length;
  questions.forEach((q, i) => {
    const ans = answers[`${subtestId}_${i}`];
    if (!ans) return;
    if (q.type === 'pilihan_majemuk') {
      if (Array.isArray(ans) && Array.isArray(q.correct))
        if ([...ans].sort().join(',') === [...q.correct].sort().join(',')) correct++;
    } else if (q.type === 'isian') {
      if (ans.toString().toLowerCase().trim() === q.correct.toString().toLowerCase().trim()) correct++;
    } else {
      if (ans === q.correct) correct++;
    }
  });
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const irt = Math.round(200 + (pct / 100) * 800);
  return { correct, total, pct, irt };
};

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
const Pill = ({ children, className = '' }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${className}`}>{children}</span>
);

const CreditBadge = ({ credits }) => (
  <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
    <Coins size={15} className="text-amber-500" />
    <span className="font-black text-amber-700 text-sm">{credits}</span>
    <span className="text-amber-500 text-xs font-medium">kredit</span>
  </div>
);

const ScoreBadge = ({ pct }) => {
  const cfg = pct >= 80 ? { bg: 'bg-emerald-500', label: 'Hebat!' }
             : pct >= 60 ? { bg: 'bg-blue-500', label: 'Baik' }
             : pct >= 40 ? { bg: 'bg-yellow-500', label: 'Cukup' }
             :              { bg: 'bg-red-500', label: 'Perlu Latihan' };
  return (
    <span className={`${cfg.bg} text-white text-xs font-bold px-2.5 py-1 rounded-full`}>{cfg.label}</span>
  );
};

// ─── CONFIRM MODAL ────────────────────────────────────────────────────────────
const ConfirmModal = ({ subtest, credits, onConfirm, onCancel }) => {
  const g = GROUP_COLORS[subtest.group];
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className={`bg-gradient-to-br ${g.bg} p-8 text-center text-white`}>
          <div className="text-5xl mb-3">{subtest.icon}</div>
          <h3 className="text-xl font-black">{subtest.name}</h3>
          <p className="text-white/70 text-sm mt-1">{subtest.group}</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Soal', val: subtest.questions, icon: <BookOpen size={16}/> },
              { label: 'Waktu', val: `${subtest.time} mnt`, icon: <Clock size={16}/> },
              { label: 'Biaya', val: `${CREDIT_COST} kredit`, icon: <Coins size={16}/> },
            ].map(({ label, val, icon }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <div className="text-gray-400 flex justify-center mb-1">{icon}</div>
                <div className="font-black text-gray-800 text-sm">{val}</div>
                <div className="text-gray-400 text-[10px] uppercase font-bold">{label}</div>
              </div>
            ))}
          </div>

          <div className={`flex items-center gap-3 p-3 rounded-xl ${credits < CREDIT_COST ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
            <Coins size={18} className={credits < CREDIT_COST ? 'text-red-500' : 'text-amber-500'} />
            <div>
              <p className={`text-sm font-bold ${credits < CREDIT_COST ? 'text-red-700' : 'text-amber-700'}`}>
                {credits < CREDIT_COST ? 'Kredit tidak cukup!' : `Saldo: ${credits} kredit → tersisa ${credits - CREDIT_COST}`}
              </p>
              {credits < CREDIT_COST && <p className="text-xs text-red-500 mt-0.5">Hubungi admin untuk top up kredit.</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onCancel} className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition">Batal</button>
            <button
              onClick={onConfirm}
              disabled={credits < CREDIT_COST}
              className={`flex-1 py-3 rounded-xl font-black text-white transition shadow-lg ${credits < CREDIT_COST ? 'bg-gray-300 cursor-not-allowed' : `bg-gradient-to-r ${g.bg} hover:opacity-90 active:scale-95`}`}
            >
              Mulai Latihan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── RESULT SCREEN ────────────────────────────────────────────────────────────
const ResultScreen = ({ subtest, result, onBack, onRetry, credits }) => {
  const g = GROUP_COLORS[subtest.group];
  const bars = [
    { label: 'Benar', val: result.correct, max: result.total, color: 'bg-emerald-500' },
    { label: 'Salah', val: result.total - result.correct, max: result.total, color: 'bg-red-400' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-br ${g.bg} p-8 text-white text-center relative overflow-hidden`}>
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10"></div>
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/10"></div>
          <div className="relative z-10">
            <div className="text-5xl mb-3">{subtest.icon}</div>
            <h2 className="text-xl font-black">{subtest.name}</h2>
            <p className="text-white/70 text-sm mt-1">Sesi Latihan Selesai</p>
          </div>
        </div>

        {/* Score Circle */}
        <div className="flex justify-center -mt-8 relative z-10">
          <div className="w-24 h-24 rounded-full bg-white shadow-xl border-4 border-white flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-gray-800">{result.pct}%</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase">Akurasi</span>
          </div>
        </div>

        <div className="p-6 space-y-5 pt-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Benar', val: result.correct, color: 'text-emerald-600' },
              { label: 'Salah', val: result.total - result.correct, color: 'text-red-500' },
              { label: 'Skor IRT', val: result.irt, color: 'text-indigo-600' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-gray-50 rounded-2xl p-3">
                <div className={`text-2xl font-black ${color}`}>{val}</div>
                <div className="text-gray-400 text-xs font-bold uppercase">{label}</div>
              </div>
            ))}
          </div>

          {/* Progress Bars */}
          <div className="space-y-3">
            {bars.map(({ label, val, max, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                  <span>{label}</span><span>{val}/{max}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${(val/max)*100}%` }}/>
                </div>
              </div>
            ))}
          </div>

          {/* Badge */}
          <div className="flex justify-center"><ScoreBadge pct={result.pct} /></div>

          {/* Buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={onRetry}
              disabled={credits < CREDIT_COST}
              className={`w-full py-3.5 rounded-2xl font-black text-white flex items-center justify-center gap-2 transition ${credits < CREDIT_COST ? 'bg-gray-300 cursor-not-allowed' : `bg-gradient-to-r ${g.bg} hover:opacity-90 shadow-lg active:scale-95`}`}
            >
              <RotateCcw size={18} /> Ulangi ({CREDIT_COST} kredit)
            </button>
            <button onClick={onBack} className="w-full py-3.5 rounded-2xl font-bold border-2 border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2 transition">
              <Home size={18} /> Kembali ke Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const UTBKPracticeApp = () => {
  // Auth
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // App
  const [screen, setScreen] = useState('dashboard'); // dashboard | practice | result
  const [bankSoal, setBankSoal] = useState({});
  const [history, setHistory] = useState([]);
  const [isLoadingBank, setIsLoadingBank] = useState(true);

  // Practice Session
  const [activeSubtest, setActiveSubtest] = useState(null);
  const [pendingSubtest, setPendingSubtest] = useState(null); // for confirm modal
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [endTime, setEndTime] = useState(null);
  const [practiceResult, setPracticeResult] = useState(null);

  const timerRef = useRef(null);

  // ── Auth listener ────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, 'users', u.uid));
          if (snap.exists()) setUserData(snap.data());
        } catch {}
      } else {
        setUserData(null);
      }
      setIsCheckingAuth(false);
    });
    return unsub;
  }, []);

  // ── Realtime credits (refetch setelah transaksi) ──────────────────────────────
  const refreshUserData = useCallback(async () => {
    if (!user) return;
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) setUserData(snap.data());
  }, [user]);

  // ── Load bank soal ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsLoadingBank(true);
      const loaded = {};
      await Promise.all(SUBTESTS.map(async (s) => {
        try {
          const snap = await getDoc(doc(db, 'bank_soal', s.id));
          loaded[s.id] = snap.exists() ? snap.data().questions : [];
        } catch { loaded[s.id] = []; }
      }));
      setBankSoal(loaded);
      setIsLoadingBank(false);
    };
    load();
  }, []);

  // ── Load history ──────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'practice_sessions'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {}
  }, [user]);

  useEffect(() => { if (user) loadHistory(); }, [user, loadHistory]);

  // ── Login ─────────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (err) {
      setLoginError('Email atau password salah. Coba lagi.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setScreen('dashboard');
    setActiveSubtest(null);
    setAnswers({});
  };

  // ── Start Practice ────────────────────────────────────────────────────────────
  const startPractice = useCallback(async (subtest) => {
    if (!userData || (userData.credits || 0) < CREDIT_COST) return;
    const bank = bankSoal[subtest.id] || [];
    if (bank.length < subtest.questions) {
      alert(`Soal ${subtest.name} belum cukup (ada ${bank.length}/${subtest.questions}).`);
      return;
    }

    // Deduct credit
    try {
      await updateDoc(doc(db, 'users', user.uid), { credits: increment(-CREDIT_COST) });
      await refreshUserData();
    } catch {
      alert('Gagal memotong kredit. Coba lagi.');
      return;
    }

    // Shuffle & pick questions
    const shuffled = [...bank].sort(() => Math.random() - 0.5).slice(0, subtest.questions);
    setQuestions(shuffled);
    setActiveSubtest(subtest);
    setAnswers({});
    setCurrentQ(0);
    setPendingSubtest(null);

    const dur = subtest.time * 60;
    setEndTime(Date.now() + dur * 1000);
    setTimeLeft(dur);
    setScreen('practice');
  }, [bankSoal, userData, user, refreshUserData]);

  // ── Timer ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (screen !== 'practice' || !endTime) return;

    timerRef.current = setInterval(() => {
      const delta = Math.floor((endTime - Date.now()) / 1000);
      if (delta <= 0) {
        clearInterval(timerRef.current);
        setTimeLeft(0);
        finishPractice();
      } else {
        setTimeLeft(delta);
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [screen, endTime]);

  // ── Answer ────────────────────────────────────────────────────────────────────
  const handleAnswer = useCallback((val, type) => {
    const k = `${activeSubtest.id}_${currentQ}`;
    setAnswers(prev => {
      if (type === 'pilihan_majemuk') {
        const cur = prev[k] || [];
        return { ...prev, [k]: cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val] };
      }
      return { ...prev, [k]: val };
    });
  }, [activeSubtest, currentQ]);

  // ── Finish ────────────────────────────────────────────────────────────────────
  const finishPractice = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const result = calcPracticeScore(answers, questions, activeSubtest.id);
    setPracticeResult(result);

    // Save to Firebase
    try {
      await addDoc(collection(db, 'practice_sessions'), {
        userId: user.uid,
        userName: userData?.displayName || user.email,
        subtestId: activeSubtest.id,
        subtestName: activeSubtest.name,
        correct: result.correct,
        total: result.total,
        pct: result.pct,
        irt: result.irt,
        createdAt: new Date().toISOString(),
      });
      await loadHistory();
    } catch {}

    setScreen('result');
  }, [answers, questions, activeSubtest, user, userData, loadHistory]);

  // ── Loading / Auth Check ──────────────────────────────────────────────────────
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={40} className="animate-spin text-indigo-500" />
          <p className="text-slate-500 font-semibold text-sm">Memuat...</p>
        </div>
      </div>
    );
  }

  // ── LOGIN SCREEN ──────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
        {/* Decorative blobs */}
        <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 mb-4">
              <BookMarked size={32} className="text-indigo-300" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Ruang Latihan</h1>
            <p className="text-indigo-300 text-sm mt-1">Platform Belajar UTBK SNBT</p>
          </div>

          {/* Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-white font-bold text-lg mb-6">Masuk dengan Akun Siswa</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1.5">Email</label>
                <input
                  type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-400 transition"
                  placeholder="email@kamu.com"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1.5">Password</label>
                <input
                  type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-400 transition"
                  placeholder="••••••••"
                />
              </div>
              {loginError && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                  <AlertCircle size={16} /> {loginError}
                </div>
              )}
              <button
                type="submit" disabled={isLoggingIn}
                className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:bg-indigo-800 text-white font-black py-3.5 rounded-xl transition shadow-lg flex items-center justify-center gap-2 mt-2"
              >
                {isLoggingIn ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                {isLoggingIn ? 'Memproses...' : 'Masuk'}
              </button>
            </form>
          </div>

          <p className="text-center text-slate-500 text-xs mt-6">
            <Copyright size={11} className="inline mr-1" />{new Date().getFullYear()} RuangSimulasi · Liezira.Tech
          </p>
        </div>
      </div>
    );
  }

  // ── RESULT SCREEN ─────────────────────────────────────────────────────────────
  if (screen === 'result' && practiceResult && activeSubtest) {
    return (
      <ResultScreen
        subtest={activeSubtest}
        result={practiceResult}
        credits={userData?.credits || 0}
        onBack={() => { setScreen('dashboard'); setActiveSubtest(null); setPracticeResult(null); }}
        onRetry={() => {
          setPracticeResult(null);
          setPendingSubtest(activeSubtest);
          setScreen('dashboard');
        }}
      />
    );
  }

  // ── PRACTICE SCREEN ───────────────────────────────────────────────────────────
  if (screen === 'practice' && activeSubtest && questions.length > 0) {
    const q = questions[currentQ];
    const key = `${activeSubtest.id}_${currentQ}`;
    const qType = q.type || 'pilihan_ganda';
    const answered = answers[key];
    const isAnswered = answered && (Array.isArray(answered) ? answered.length > 0 : true);
    const answeredCount = questions.filter((_, i) => {
      const k = `${activeSubtest.id}_${i}`;
      const a = answers[k];
      return a && (Array.isArray(a) ? a.length > 0 : true);
    }).length;
    const progress = (answeredCount / questions.length) * 100;
    const isLow = timeLeft <= 60;
    const g = GROUP_COLORS[activeSubtest.group];

    return (
      <div className="min-h-screen bg-slate-50 pb-10">
        {/* ─ Header ─ */}
        <div className={`sticky top-0 z-40 bg-gradient-to-r ${g.bg} text-white shadow-lg`}>
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider">{activeSubtest.group}</p>
              <h2 className="font-black text-base leading-tight truncate">{activeSubtest.icon} {activeSubtest.name}</h2>
            </div>

            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-black text-lg ${isLow ? 'bg-red-500 animate-pulse' : 'bg-white/20'}`}>
              <Clock size={18} className={isLow ? 'text-white' : 'text-white/70'} />
              {formatTime(timeLeft)}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-white/20">
            <div className="h-full bg-white/80 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>

          {/* Soal counter */}
          <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between text-white/80 text-xs font-semibold">
            <span>Soal {currentQ + 1} / {questions.length}</span>
            <span>{answeredCount} dijawab</span>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
          {/* Question Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {/* Question number + type pill */}
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${g.bg} text-white flex items-center justify-center font-black text-sm`}>
                {currentQ + 1}
              </div>
              <Pill className="bg-indigo-50 text-indigo-600 border border-indigo-100">
                {qType === 'pilihan_majemuk' ? '☑ Pilihan Majemuk' : qType === 'isian' ? '✏️ Isian' : '○ Pilihan Ganda'}
              </Pill>
            </div>

            <div className="text-gray-800 text-base leading-relaxed font-medium mb-4 whitespace-pre-wrap">
              <Latex>{q.question}</Latex>
            </div>

            {q.image && (
              <img src={q.image} alt="Gambar soal" className="w-full h-auto rounded-xl my-4 object-contain border border-gray-100" draggable="false" />
            )}
          </div>

          {/* Answer Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {qType === 'isian' ? (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">Jawaban Kamu:</label>
                <input
                  type="text"
                  value={answers[key] || ''}
                  onChange={e => handleAnswer(e.target.value, 'isian')}
                  className="w-full p-4 text-lg font-mono border-2 border-indigo-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition"
                  placeholder="Ketik jawaban..."
                />
              </div>
            ) : (
              <div className="space-y-3">
                {['A','B','C','D','E'].map((l, i) => {
                  const opt = q.options?.[i];
                  if (!opt) return null;
                  const sel = qType === 'pilihan_majemuk'
                    ? (answers[key] || []).includes(l)
                    : answers[key] === l;
                  return (
                    <button
                      key={l}
                      onClick={() => handleAnswer(l, qType)}
                      className={`w-full text-left p-4 rounded-xl border-2 flex items-center gap-3 transition active:scale-[0.98] ${sel ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0 transition ${sel ? `bg-gradient-to-br ${g.bg} text-white shadow` : 'bg-gray-100 text-gray-600'}`}>{l}</div>
                      <span className="text-gray-700 font-medium flex-1"><Latex>{opt}</Latex></span>
                      {sel && <CheckCircle2 size={18} className="text-indigo-500 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentQ(p => p - 1)}
              disabled={currentQ === 0}
              className="px-5 py-3.5 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold disabled:opacity-40 hover:bg-gray-50 flex items-center gap-1.5 transition"
            >
              <ChevronLeft size={18} /> Kembali
            </button>

            {currentQ < questions.length - 1 ? (
              <button
                onClick={() => setCurrentQ(p => p + 1)}
                className={`flex-1 py-3.5 rounded-xl font-black text-white flex items-center justify-center gap-2 transition shadow-md bg-gradient-to-r ${g.bg} hover:opacity-90 active:scale-[0.98]`}
              >
                Selanjutnya <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={() => {
                  if (confirm(`Selesaikan latihan?\n\nTerjawab: ${answeredCount}/${questions.length} soal`)) finishPractice();
                }}
                className="flex-1 py-3.5 rounded-xl font-black text-white bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center gap-2 transition shadow-md active:scale-[0.98]"
              >
                <CheckCircle2 size={18} /> Selesai
              </button>
            )}
          </div>

          {/* Mini nav grid */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold text-gray-400 uppercase mb-3">Navigasi Cepat</p>
            <div className="grid grid-cols-10 gap-1.5">
              {questions.map((_, idx) => {
                const k = `${activeSubtest.id}_${idx}`;
                const a = answers[k];
                const done = a && (Array.isArray(a) ? a.length > 0 : true);
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentQ(idx)}
                    className={`h-8 rounded-lg text-[11px] font-bold transition ${idx === currentQ ? `bg-gradient-to-br ${g.bg} text-white shadow ring-2 ring-offset-1 ring-indigo-400` : done ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────────────────
  const credits = userData?.credits || 0;
  const groups = [...new Set(SUBTESTS.map(s => s.group))];

  // Best score per subtest dari history
  const bestScores = {};
  history.forEach(h => {
    if (!bestScores[h.subtestId] || h.pct > bestScores[h.subtestId].pct) {
      bestScores[h.subtestId] = h;
    }
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Confirm Modal */}
      {pendingSubtest && (
        <ConfirmModal
          subtest={pendingSubtest}
          credits={credits}
          onCancel={() => setPendingSubtest(null)}
          onConfirm={() => startPractice(pendingSubtest)}
        />
      )}

      {/* ─ Topbar ─ */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <BookMarked size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-black text-gray-900 text-base leading-none">Ruang Latihan</h1>
              <p className="text-gray-400 text-[11px] mt-0.5">UTBK SNBT</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CreditBadge credits={credits} />
            <button onClick={handleLogout} className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* ─ Welcome Banner ─ */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/2 w-32 h-32 rounded-full bg-white/5 translate-y-1/2" />
          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="text-indigo-200 text-sm font-medium">Selamat datang,</p>
              <h2 className="text-2xl font-black mt-0.5">{userData?.displayName || user.email}</h2>
              <p className="text-indigo-200 text-sm mt-2 flex items-center gap-1.5">
                <Target size={14} /> Pilih subtes, mulai latihan, raih skor terbaik!
              </p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 text-center min-w-[100px] border border-white/20">
              <div className="text-3xl font-black">{history.length}</div>
              <div className="text-indigo-200 text-xs font-bold uppercase mt-0.5">Sesi Latihan</div>
            </div>
          </div>
        </div>

        {/* ─ Loading bank soal ─ */}
        {isLoadingBank && (
          <div className="flex items-center justify-center gap-3 py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">Memuat bank soal...</span>
          </div>
        )}

        {/* ─ Subtest Cards by Group ─ */}
        {!isLoadingBank && groups.map(group => {
          const subtests = SUBTESTS.filter(s => s.group === group);
          const gc = GROUP_COLORS[group];
          return (
            <div key={group}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`h-1 w-8 rounded-full bg-gradient-to-r ${gc.bg}`} />
                <h3 className="font-black text-gray-700 text-base uppercase tracking-wide">{group}</h3>
                <div className={`h-px flex-1 bg-gradient-to-r ${gc.bg} opacity-20`} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {subtests.map(s => {
                  const best = bestScores[s.id];
                  const bankReady = (bankSoal[s.id]?.length || 0) >= s.questions;
                  const canStart = bankReady && credits >= CREDIT_COST;
                  const sessionCount = history.filter(h => h.subtestId === s.id).length;

                  return (
                    <div
                      key={s.id}
                      className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition hover:shadow-md ${canStart ? 'border-gray-100 hover:border-indigo-200 cursor-pointer' : 'border-gray-100 opacity-80'}`}
                      onClick={() => canStart && setPendingSubtest(s)}
                    >
                      {/* Card Top */}
                      <div className={`bg-gradient-to-r ${gc.bg} p-5 flex items-center justify-between`}>
                        <div>
                          <div className="text-3xl mb-1">{s.icon}</div>
                          <h4 className="text-white font-black text-sm leading-tight">{s.name}</h4>
                          <p className="text-white/60 text-xs mt-0.5">{s.group}</p>
                        </div>
                        {best ? (
                          <div className="text-center bg-white/15 rounded-xl p-3 border border-white/20">
                            <div className="text-2xl font-black text-white">{best.pct}%</div>
                            <div className="text-white/60 text-[10px] font-bold uppercase">Best</div>
                          </div>
                        ) : (
                          <div className="text-center bg-white/10 rounded-xl p-3 border border-white/20">
                            <div className="text-2xl font-black text-white/40">—</div>
                            <div className="text-white/40 text-[10px] font-bold uppercase">Belum</div>
                          </div>
                        )}
                      </div>

                      {/* Card Bottom */}
                      <div className="p-4 flex items-center justify-between gap-3">
                        <div className="flex gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><BookOpen size={12} /> {s.questions} soal</span>
                          <span className="flex items-center gap-1"><Clock size={12} /> {s.time} mnt</span>
                          {sessionCount > 0 && (
                            <span className="flex items-center gap-1"><RotateCcw size={12} /> {sessionCount}x</span>
                          )}
                        </div>

                        {!bankReady ? (
                          <Pill className="bg-gray-100 text-gray-400">Soal belum siap</Pill>
                        ) : credits < CREDIT_COST ? (
                          <Pill className="bg-red-50 text-red-400"><Lock size={10} /> Kredit kurang</Pill>
                        ) : (
                          <div className={`flex items-center gap-1.5 bg-gradient-to-r ${gc.bg} text-white text-xs font-black px-3 py-1.5 rounded-full shadow-sm`}>
                            <PlayCircle size={13} /> Mulai · {CREDIT_COST}kr
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* ─ History ─ */}
        {history.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-1 w-8 rounded-full bg-gradient-to-r from-slate-400 to-slate-600" />
              <h3 className="font-black text-gray-700 text-base uppercase tracking-wide">Riwayat Latihan</h3>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-50">
                {history.slice(0, 10).map((h, i) => {
                  const s = SUBTESTS.find(x => x.id === h.subtestId);
                  const gc = s ? GROUP_COLORS[s.group] : GROUP_COLORS.TPS;
                  return (
                    <div key={h.id || i} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gc.bg} flex items-center justify-center text-base flex-shrink-0`}>
                          {s?.icon || '📝'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-800 text-sm truncate">{h.subtestName}</p>
                          <p className="text-gray-400 text-xs flex items-center gap-1 mt-0.5">
                            <Calendar size={11} />
                            {new Date(h.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="font-black text-gray-800 text-base">{h.pct}%</p>
                          <p className="text-gray-400 text-xs">{h.correct}/{h.total} benar</p>
                        </div>
                        <ScoreBadge pct={h.pct} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-gray-400 text-xs font-mono flex items-center justify-center gap-1">
            <Copyright size={11} /> {new Date().getFullYear()} Created by <span className="font-bold text-indigo-500">Liezira.Tech</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default UTBKPracticeApp;
