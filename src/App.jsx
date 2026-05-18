import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Wind, Dumbbell, BookOpen, Brain, Heart, Clock,
  LogOut, X, Check, RefreshCw, Play, Pause, Moon,
  AlertCircle, Zap, Coffee, Calendar,
} from 'lucide-react'

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const hasSupabase = !!(SUPA_URL && SUPA_KEY && !SUPA_URL.includes('placeholder'))
const supabase = createClient(
  SUPA_URL || 'https://placeholder.supabase.co',
  SUPA_KEY || 'placeholder'
)

// ── Static data ───────────────────────────────────────────────────────────────
const MICRO_WINS = [
  'Step outside for 2 minutes and look at the sky.',
  'Drink a full glass of water slowly.',
  'Stand up, shake your hands, and take 3 deep breaths.',
  'Write one thing you\'re grateful for right now.',
  'Do 10 slow neck rolls, 5 each direction.',
  'Close your eyes and listen to ambient sound for 60 seconds.',
  'Wash your face with cold water.',
  'Stretch your arms above your head and breathe deeply.',
]

const GROUNDING_PROMPTS = [
  'Name 3 blue objects you can see from here.',
  'Feel your feet on the floor. Notice the full weight of your body.',
  'What\'s one thing you can smell right now?',
  'Look out a window. Find something that\'s moving.',
  'Name 5 things you see, 4 you can touch, 3 you can hear.',
]

const TEMPLATES = {
  'Quick Home': `Warm-up:
A. Jumping Jacks 30*2
B. Hip circles 10*2
Workout:
A. 3x15 Pushups
B. 3x20 Bodyweight Squats
C. 3x10 Tricep Dips
D. Plank 1 min*3
E. 3x12 Glute Bridges`,
  'Beginner Gym': `Workout:
A. 3x12 Bench Press
B. 3x10 Back Squat
C. 3x8 Deadlift
D. 3x12 Lat Pulldown
E. 3x15 Shoulder Press
Core:
A. Plank 1 min*3
B. Dead bug 10*3`,
  'Mobility Stretch': `Warm-up:
A. Cat-cow 10*2
Mobility:
A. Hip flexor stretch 30secs hold 2*2
B. Pigeon pose 45secs hold 2*2
C. Thoracic rotation 10*2
Cool-down:
A. Childs pose 1 min*2
B. Foam rolling 10 min`,
}

// ── Day helpers ───────────────────────────────────────────────────────────────
const getToday = () => new Date().toISOString().split('T')[0]
const DAY_KEYS  = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const todayDayIdx = () => (new Date().getDay() + 6) % 7  // Mon=0 … Sun=6

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// ── Workout parser ────────────────────────────────────────────────────────────
const HEADER_RE = /^(Day\s+\d+|Activations?|Core|Accessory|Warm[\s-]?up|Cool[\s-]?down|Cardio|Stretching?|Mobility|Strength|Workout|Notes?|Circuit|HIIT|Plyometrics?)\s*:?\s*$/i

function parseWorkout(text) {
  if (!text.trim()) return []

  return text.split('\n').filter(l => l.trim()).map((line, i) => {
    const t = line.trim()

    // ── Section header detection ──
    if (t.endsWith(':') || HEADER_RE.test(t)) {
      return { id: i, isHeader: true, exercise: t.replace(/:$/, '').trim(), completed: false, sets: null, reps: null, duration: null, distance: null }
    }

    // Strip leading letter prefix: "A.", "B. ", "12." etc.
    const cleaned = t.replace(/^[A-Za-z\d]{1,2}\.\s*/, '')

    // "Plank 1 min*3"  — duration*sets
    const mMinStar = cleaned.match(/^(.+?)\s+(\d+(?::\d+)?)\s*min\s*[*×xX]\s*(\d+)\s*$/i)
    if (mMinStar) return { id: i, isHeader: false, exercise: mMinStar[1].trim(), duration: `${mMinStar[2]} min`, sets: +mMinStar[3], reps: null, distance: null, completed: false }

    // "Plank 30s*3" / "Plank 30secs*3"  — secs*sets
    const mSecStar = cleaned.match(/^(.+?)\s+(\d+)\s*s(?:ec(?:s)?)?\s*[*×xX]\s*(\d+)\s*$/i)
    if (mSecStar) return { id: i, isHeader: false, exercise: mSecStar[1].trim(), duration: `${mSecStar[2]}s`, sets: +mSecStar[3], reps: null, distance: null, completed: false }

    // "Swiss ball squats 8kgs 10*3"  — exercise reps*sets
    const mStar = cleaned.match(/^(.+?)\s+(\d+)\s*\*\s*(\d+)\s*$/)
    if (mStar) return { id: i, isHeader: false, exercise: mStar[1].trim(), reps: +mStar[2], sets: +mStar[3], duration: null, distance: null, completed: false }

    // "3x12 Squats" / "3 x 12 Bench Press"
    const m1 = cleaned.match(/^(\d+)\s*[xX×]\s*(\d+)\s+(.+)/)
    if (m1) return { id: i, isHeader: false, sets: +m1[1], reps: +m1[2], duration: null, distance: null, exercise: m1[3].trim(), completed: false }

    // "4 sets Bench Press" / "4 sets of Deadlift"
    const m2 = cleaned.match(/^(\d+)\s+sets?\s+(?:of\s+)?(.+)/i)
    if (m2) return { id: i, isHeader: false, sets: +m2[1], reps: null, duration: null, distance: null, exercise: m2[2].trim(), completed: false }

    // "Bench Press - 3x12" / "Squats - 4 sets"
    const m3 = cleaned.match(/^(.+?)\s*[-–]\s*(\d+)\s*(?:[xX×]\s*(\d+))?\s*sets?/i)
    if (m3) return { id: i, isHeader: false, sets: +m3[2], reps: m3[3] ? +m3[3] : null, duration: null, distance: null, exercise: m3[1].trim(), completed: false }

    // "5km Run" / "5 mi Walk"
    const m4 = cleaned.match(/^([\d.]+)\s*(km|mi|m)\s+(.+)/i)
    if (m4) return { id: i, isHeader: false, sets: null, reps: null, duration: null, distance: `${m4[1]}${m4[2]}`, exercise: m4[3].trim(), completed: false }

    // "30 min Foam Rolling"
    const m5 = cleaned.match(/^(\d+)\s*min\s+(.+)/i)
    if (m5) return { id: i, isHeader: false, sets: null, reps: null, duration: `${m5[1]} min`, distance: null, exercise: m5[2].trim(), completed: false }

    // No digits at all → treat as header
    if (!/\d/.test(cleaned)) {
      return { id: i, isHeader: true, exercise: cleaned, completed: false, sets: null, reps: null, duration: null, distance: null }
    }

    return { id: i, isHeader: false, sets: null, reps: null, duration: null, distance: null, exercise: cleaned, completed: false }
  })
}

function exerciseLabel(ex) {
  const parts = []
  if (ex.reps && ex.sets)           parts.push(`${ex.reps}×${ex.sets}`)
  else if (ex.duration && ex.sets)  parts.push(`${ex.duration} × ${ex.sets}`)
  else if (ex.sets)                 parts.push(`${ex.sets} sets`)
  if (!ex.sets && ex.duration)      parts.push(ex.duration)
  if (ex.distance)                  parts.push(ex.distance)
  return parts.length > 0 ? `${ex.exercise} · ${parts.join(', ')}` : ex.exercise
}

// ── Default state ─────────────────────────────────────────────────────────────
const EMPTY_WEEK = { mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '' }

const DEFAULT_STATE = {
  lastDate: getToday(),
  anchors: {
    workout:  { completed: false, isRestDay: false },
    read:     { completed: false },
    meditate: { completed: false, duration: null },
    checkin:  { completed: false, mood: 5 },
  },
  workoutText: '',
  exercises:   [],
  weekPlan:    { ...EMPTY_WEEK },
  history:     {},
  shutdown:    { triggered: false, success: '' },
  settings:    { tranceInterval: 60, eveningMode: false },
}

// ── BreathingPacer ────────────────────────────────────────────────────────────
function BreathingPacer() {
  const [phase, setPhase] = useState('hold-out')

  useEffect(() => {
    const seq = [
      { name: 'in',       ms: 4000 },
      { name: 'hold-in',  ms: 4000 },
      { name: 'out',      ms: 4000 },
      { name: 'hold-out', ms: 4000 },
    ]
    let idx = 0
    let t
    const next = () => { const { name, ms } = seq[idx++ % seq.length]; setPhase(name); t = setTimeout(next, ms) }
    next()
    return () => clearTimeout(t)
  }, [])

  const expanded = phase === 'in' || phase === 'hold-in'
  const label = { in: 'Breathe In', 'hold-in': 'Hold', out: 'Breathe Out', 'hold-out': 'Hold' }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-44 h-44 flex items-center justify-center">
        <div
          className="absolute rounded-full bg-sage/20 transition-all duration-[4000ms] ease-in-out"
          style={{ width: expanded ? '176px' : '80px', height: expanded ? '176px' : '80px' }}
        />
        <div
          className="absolute rounded-full bg-sage/35 transition-all duration-[4000ms] ease-in-out"
          style={{ width: expanded ? '124px' : '56px', height: expanded ? '124px' : '56px' }}
        />
        <Wind className="w-8 h-8 text-sage relative z-10" />
      </div>
      <p className="text-xl font-light text-sage-light tracking-[0.2em] uppercase">{label[phase]}</p>
      <p className="text-mineral/40 text-xs tracking-widest">Box Breathing · 4-4-4-4</p>
    </div>
  )
}

// ── WorkTranceOverlay ─────────────────────────────────────────────────────────
function WorkTranceOverlay({ prompt, onDismiss }) {
  return (
    <div className="fixed inset-0 z-50 bg-surface-dark/92 backdrop-blur-md flex flex-col items-center justify-center p-8">
      <div className="max-w-sm w-full text-center space-y-8">
        <p className="text-mineral/40 text-xs tracking-[0.3em] uppercase">Time to Surface</p>
        <BreathingPacer />
        <div className="bg-card-dark/70 rounded-2xl p-5 border border-mineral/10">
          <p className="text-mineral/40 text-xs tracking-widest uppercase mb-2">Grounding</p>
          <p className="text-sage-light text-lg font-light leading-relaxed">{prompt}</p>
        </div>
        <button
          onClick={onDismiss}
          className="w-full py-3 rounded-xl border border-sage/30 text-sage text-sm tracking-widest hover:bg-sage/10 transition-colors"
        >
          Back to Work
        </button>
      </div>
    </div>
  )
}

// ── StuckModal ────────────────────────────────────────────────────────────────
function StuckModal({ onClose }) {
  const [win] = useState(() => rand(MICRO_WINS))
  return (
    <div className="fixed inset-0 z-50 bg-surface-dark/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-card-dark max-w-sm w-full rounded-2xl p-8 border border-mineral/10 text-center space-y-6">
        <div className="w-12 h-12 rounded-full bg-sage/20 flex items-center justify-center mx-auto">
          <Zap className="w-6 h-6 text-sage" />
        </div>
        <div>
          <p className="text-mineral/40 text-xs tracking-[0.3em] uppercase mb-3">Your Micro-Win</p>
          <p className="text-sage-light text-xl font-light leading-relaxed">{win}</p>
        </div>
        <p className="text-mineral/40 text-xs">Just this one thing. That's enough.</p>
        <button onClick={onClose} className="w-full py-3 rounded-xl bg-sage/20 text-sage text-sm tracking-wide hover:bg-sage/30 transition-colors">
          I can do this
        </button>
      </div>
    </div>
  )
}

// ── ExercisePreviewList (shared) ──────────────────────────────────────────────
function ExercisePreviewList({ exercises }) {
  return (
    <div className="space-y-1.5">
      {exercises.map(ex =>
        ex.isHeader ? (
          <p key={ex.id} className="text-mineral/40 text-xs tracking-widest uppercase pt-2 first:pt-0">{ex.exercise}</p>
        ) : (
          <div key={ex.id} className="flex items-center gap-3 py-2 px-3 bg-surface-dark/40 rounded-lg">
            <div className="w-4 h-4 rounded-full border border-sage/30 flex-shrink-0" />
            <span className="text-mineral/70 text-sm">{exerciseLabel(ex)}</span>
          </div>
        )
      )}
    </div>
  )
}

// ── WorkoutInputArea (shared) ─────────────────────────────────────────────────
function WorkoutInputArea({ value, onChange }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={'A. Squats 10*3\nB. Bench Press 8*4\nPlank 1 min*3\n\nOr paste any format — the parser handles it.'}
      rows={7}
      className="w-full bg-surface-dark/50 border border-mineral/20 rounded-xl p-3 text-mineral/80 text-sm placeholder-mineral/20 resize-none focus:outline-none focus:border-sage/40 font-mono"
    />
  )
}

// ── WorkoutParserModal ────────────────────────────────────────────────────────
function WorkoutParserModal({ state, onSave, onClose }) {
  const [text, setText] = useState(state.workoutText)
  const [activeTpl, setActiveTpl] = useState(null)
  const preview = parseWorkout(text)

  const loadTemplate = (name) => { setActiveTpl(name); setText(TEMPLATES[name]) }

  return (
    <div className="fixed inset-0 z-40 bg-surface-dark/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-card-dark w-full max-w-lg rounded-2xl border border-mineral/10 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-mineral/10 flex-shrink-0">
          <h2 className="text-mineral text-sm font-medium tracking-wide">Today's Workout</h2>
          <button onClick={onClose} className="text-mineral/40 hover:text-mineral transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 border-b border-mineral/10 flex-shrink-0">
          <p className="text-mineral/40 text-xs tracking-[0.2em] uppercase mb-3">Starter Templates</p>
          <div className="flex gap-2 flex-wrap">
            {Object.keys(TEMPLATES).map(name => (
              <button key={name} onClick={() => loadTemplate(name)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${activeTpl === name ? 'bg-sage/20 border-sage/40 text-sage' : 'border-mineral/20 text-mineral/50 hover:border-sage/30 hover:text-mineral/80'}`}>
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 flex-1 overflow-auto min-h-0">
          <p className="text-mineral/40 text-xs tracking-[0.2em] uppercase mb-2">Paste or type your routine</p>
          <WorkoutInputArea value={text} onChange={t => { setText(t); setActiveTpl(null) }} />
          {preview.length > 0 && (
            <div className="mt-4">
              <p className="text-mineral/40 text-xs tracking-[0.2em] uppercase mb-3">Preview</p>
              <ExercisePreviewList exercises={preview} />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-mineral/10 flex-shrink-0">
          <button onClick={() => onSave(text, preview)}
            className="w-full py-3 rounded-xl bg-sage/20 text-sage text-sm tracking-wide hover:bg-sage/30 transition-colors">
            Save Workout
          </button>
        </div>
      </div>
    </div>
  )
}

// ── WeekPlannerModal ──────────────────────────────────────────────────────────
function WeekPlannerModal({ weekPlan, onSave, onClose }) {
  const todayIdx = todayDayIdx()
  const [plan, setPlan] = useState({ ...EMPTY_WEEK, ...weekPlan })
  const [activeDay, setActiveDay] = useState(todayIdx)
  const [activeTpl, setActiveTpl] = useState(null)

  const currentKey = DAY_KEYS[activeDay]
  const currentText = plan[currentKey] || ''

  const setDayText = (text) => {
    setActiveTpl(null)
    setPlan(prev => ({ ...prev, [currentKey]: text }))
  }

  const loadTemplate = (name) => { setActiveTpl(name); setDayText(TEMPLATES[name]) }
  const setRest = () => { setActiveTpl('rest'); setDayText('REST') }

  const preview = currentText && currentText !== 'REST' ? parseWorkout(currentText) : []

  return (
    <div className="fixed inset-0 z-40 bg-surface-dark/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-card-dark w-full max-w-lg rounded-2xl border border-mineral/10 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-mineral/10 flex-shrink-0">
          <h2 className="text-mineral text-sm font-medium tracking-wide">Week Plan</h2>
          <button onClick={onClose} className="text-mineral/40 hover:text-mineral transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {/* Day tabs */}
        <div className="flex border-b border-mineral/10 flex-shrink-0">
          {DAY_LABELS.map((day, i) => {
            const key = DAY_KEYS[i]
            const hasContent = !!(plan[key] && plan[key].trim())
            const isToday = i === todayIdx
            const isActive = i === activeDay
            return (
              <button key={day} onClick={() => { setActiveDay(i); setActiveTpl(null) }}
                className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs font-medium transition-colors border-b-2 ${isActive ? 'text-sage border-sage' : 'text-mineral/35 border-transparent hover:text-mineral/60'}`}>
                {day}
                <div className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-sage/60' : hasContent ? 'bg-mineral/30' : 'bg-transparent'}`} />
              </button>
            )
          })}
        </div>

        <div className="p-4 flex-1 overflow-auto min-h-0">
          {/* Templates row */}
          <div className="flex gap-2 flex-wrap mb-3">
            {Object.keys(TEMPLATES).map(name => (
              <button key={name} onClick={() => loadTemplate(name)}
                className={`px-3 py-1 rounded-lg text-xs border transition-colors ${activeTpl === name ? 'bg-sage/20 border-sage/40 text-sage' : 'border-mineral/15 text-mineral/40 hover:border-sage/30 hover:text-mineral/70'}`}>
                {name}
              </button>
            ))}
            <button onClick={setRest}
              className={`px-3 py-1 rounded-lg text-xs border transition-colors ${activeTpl === 'rest' ? 'bg-sage/10 border-sage/25 text-sage/70' : 'border-mineral/15 text-mineral/40 hover:border-sage/30'}`}>
              Rest day
            </button>
          </div>

          {currentText === 'REST' ? (
            <div className="flex items-center gap-2 text-mineral/40 text-sm py-2">
              <Coffee className="w-4 h-4 text-sage/40" />
              Rest &amp; Recovery — no workout
            </div>
          ) : (
            <WorkoutInputArea value={currentText} onChange={setDayText} />
          )}

          {preview.length > 0 && (
            <div className="mt-3">
              <ExercisePreviewList exercises={preview} />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-mineral/10 flex-shrink-0 space-y-2">
          <button onClick={() => onSave(plan)}
            className="w-full py-3 rounded-xl bg-sage/20 text-sage text-sm tracking-wide hover:bg-sage/30 transition-colors">
            Save Week Plan
          </button>
          <p className="text-mineral/25 text-xs text-center">Today's workout loads automatically each morning</p>
        </div>
      </div>
    </div>
  )
}

// ── ShutdownModal ─────────────────────────────────────────────────────────────
function ShutdownModal({ state, onSave, onClose }) {
  const [success, setSuccess] = useState(state.shutdown.success || '')
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' })

  return (
    <div className="fixed inset-0 z-40 bg-surface-dark/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-card-dark max-w-sm w-full rounded-2xl border border-mineral/10 overflow-hidden">
        <div className="p-6 space-y-5">
          <div className="text-center">
            <Moon className="w-7 h-7 text-sage mx-auto mb-3" />
            <h2 className="text-mineral font-medium text-sm tracking-wide">Shutdown Ritual</h2>
            <p className="text-mineral/40 text-xs mt-1">Close the loop. Reclaim your evening.</p>
          </div>

          <div>
            <p className="text-mineral/40 text-xs tracking-[0.2em] uppercase mb-2">One success today</p>
            <textarea value={success} onChange={e => setSuccess(e.target.value)}
              placeholder="I shipped the feature I've been working on..."
              rows={3}
              className="w-full bg-surface-dark/50 border border-mineral/20 rounded-xl p-3 text-mineral/80 text-sm placeholder-mineral/20 resize-none focus:outline-none focus:border-sage/40" />
          </div>

          {state.exercises.filter(ex => !ex.isHeader).length > 0 && (
            <div className="bg-surface-dark/40 rounded-xl p-4">
              <p className="text-mineral/40 text-xs tracking-[0.2em] uppercase mb-2">{tomorrowName}'s workout</p>
              <div className="space-y-1">
                {state.exercises.filter(ex => !ex.isHeader).slice(0, 4).map((ex, i) => (
                  <p key={i} className="text-mineral/60 text-sm">{exerciseLabel(ex)}</p>
                ))}
                {state.exercises.filter(ex => !ex.isHeader).length > 4 && (
                  <p className="text-mineral/30 text-xs">+{state.exercises.filter(ex => !ex.isHeader).length - 4} more</p>
                )}
              </div>
            </div>
          )}

          <button onClick={() => onSave(success)}
            className="w-full py-3 rounded-xl bg-sage/20 text-sage text-sm tracking-widest hover:bg-sage/30 transition-colors">
            Begin Evening Mode
          </button>
          <button onClick={onClose} className="w-full text-center text-mineral/25 text-xs hover:text-mineral/50 transition-colors py-1">
            Not yet
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AnchorCard ────────────────────────────────────────────────────────────────
function AnchorCard({ icon: Icon, label, completed, onToggle, children }) {
  return (
    <div className={`bg-card-dark rounded-2xl p-5 border transition-all duration-300 ${completed ? 'border-sage/30' : 'border-mineral/10'}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${completed ? 'bg-sage/20' : 'bg-surface-dark/60'}`}>
            <Icon className={`w-5 h-5 transition-colors ${completed ? 'text-sage' : 'text-mineral/35'}`} />
          </div>
          <span className={`text-sm font-medium transition-colors ${completed ? 'text-sage' : 'text-mineral/65'}`}>{label}</span>
        </div>
        <button onClick={onToggle}
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${completed ? 'border-sage bg-sage' : 'border-mineral/25 hover:border-sage/50'}`}>
          {completed && <Check className="w-3.5 h-3.5 text-white" />}
        </button>
      </div>
      {children}
    </div>
  )
}

// ── WorkoutCard ───────────────────────────────────────────────────────────────
function WorkoutCard({ state, onUpdate, onOpenToday, onOpenWeek }) {
  const { workout } = state.anchors

  const toggleRestDay = () => onUpdate(prev => ({
    ...prev,
    anchors: { ...prev.anchors, workout: { ...prev.anchors.workout, isRestDay: !workout.isRestDay, completed: !workout.isRestDay } },
  }))

  const toggleExercise = (id) => {
    const updated = state.exercises.map(ex => ex.id === id && !ex.isHeader ? { ...ex, completed: !ex.completed } : ex)
    const nonHeaders = updated.filter(ex => !ex.isHeader)
    const allDone = nonHeaders.length > 0 && nonHeaders.every(ex => ex.completed)
    onUpdate(prev => ({
      ...prev,
      exercises: updated,
      anchors: { ...prev.anchors, workout: { ...prev.anchors.workout, completed: allDone } },
    }))
  }

  const toggleWorkout = () => onUpdate(prev => ({
    ...prev,
    anchors: { ...prev.anchors, workout: { ...prev.anchors.workout, completed: !workout.completed } },
  }))

  if (workout.isRestDay) {
    return (
      <div className="bg-card-dark rounded-2xl p-5 border border-sage/15">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sage/10 flex items-center justify-center">
              <Coffee className="w-5 h-5 text-sage/50" />
            </div>
            <div>
              <p className="text-sage/60 text-sm font-medium">Rest & Recovery</p>
              <p className="text-mineral/35 text-xs mt-0.5">Your body grows stronger at rest.</p>
            </div>
          </div>
          <button onClick={toggleRestDay} className="text-mineral/25 text-xs hover:text-mineral/55 transition-colors">Undo</button>
        </div>
      </div>
    )
  }

  return (
    <AnchorCard icon={Dumbbell} label="Workout" completed={workout.completed} onToggle={toggleWorkout}>
      {state.exercises.length > 0 ? (
        <div className="space-y-1.5">
          {state.exercises.map(ex =>
            ex.isHeader ? (
              <div key={ex.id} className="pt-2 first:pt-0">
                <p className="text-mineral/35 text-xs tracking-widest uppercase">{ex.exercise}</p>
              </div>
            ) : (
              <button key={ex.id} onClick={() => toggleExercise(ex.id)} className="w-full flex items-center gap-3 text-left group">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${ex.completed ? 'border-sage bg-sage' : 'border-mineral/25 group-hover:border-sage/50'}`}>
                  {ex.completed && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className={`text-sm transition-colors ${ex.completed ? 'text-mineral/30 line-through' : 'text-mineral/65'}`}>
                  {exerciseLabel(ex)}
                </span>
              </button>
            )
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={onOpenToday} className="text-mineral/30 text-xs hover:text-mineral/60 transition-colors">Edit today</button>
            <span className="text-mineral/15">·</span>
            <button onClick={onOpenWeek} className="text-mineral/30 text-xs hover:text-mineral/60 transition-colors">Plan week</button>
            <span className="text-mineral/15">·</span>
            <button onClick={toggleRestDay} className="text-mineral/30 text-xs hover:text-mineral/60 transition-colors">Rest day</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={onOpenToday}
            className="flex-1 py-2 rounded-lg border border-dashed border-mineral/20 text-mineral/35 text-sm hover:border-sage/40 hover:text-sage/70 transition-colors">
            + Today's workout
          </button>
          <button onClick={onOpenWeek}
            className="px-3 py-2 rounded-lg border border-dashed border-mineral/20 text-mineral/35 text-xs hover:border-sage/40 hover:text-sage/70 transition-colors flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Week
          </button>
          <button onClick={toggleRestDay}
            className="px-3 py-2 rounded-lg border border-dashed border-mineral/20 text-mineral/35 text-xs hover:border-sage/40 hover:text-sage/70 transition-colors">
            Rest
          </button>
        </div>
      )}
    </AnchorCard>
  )
}

// ── CheckinCard ───────────────────────────────────────────────────────────────
function CheckinCard({ state, onUpdate }) {
  const { checkin } = state.anchors
  const emoji = checkin.mood <= 3 ? '🌧️' : checkin.mood <= 6 ? '⛅' : '☀️'
  const label = checkin.mood <= 3 ? 'Rough' : checkin.mood <= 6 ? 'Okay' : 'Good'

  const toggle  = () => onUpdate(prev => ({ ...prev, anchors: { ...prev.anchors, checkin: { ...prev.anchors.checkin, completed: !checkin.completed } } }))
  const setMood = (v) => onUpdate(prev => ({ ...prev, anchors: { ...prev.anchors, checkin: { ...prev.anchors.checkin, mood: v } } }))

  return (
    <AnchorCard icon={Heart} label="Check-in" completed={checkin.completed} onToggle={toggle}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-2xl">{emoji}</span>
          <span className="text-mineral/45 text-sm">{label} · {checkin.mood}/10</span>
        </div>
        <input type="range" min="1" max="10" value={checkin.mood} onChange={e => setMood(+e.target.value)} className="w-full" />
      </div>
    </AnchorCard>
  )
}

// ── MeditateCard ─────────────────────────────────────────────────────────────
const BREATH_PHASES = [
  { name: 'in',       ms: 4000, freq: 528 },
  { name: 'hold-in',  ms: 4000, freq: 480 },
  { name: 'out',      ms: 4000, freq: 432 },
  { name: 'hold-out', ms: 4000, freq: 396 },
]

function useTone() {
  const ctxRef = useRef(null)

  const getCtx = () => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }

  const play = (freq, fade = 1.0) => {
    try {
      const ctx  = getCtx()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.1, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, t + fade)
      osc.start(t); osc.stop(t + fade + 0.05)
    } catch {}
  }

  const chime = () => {
    [396, 432, 528].forEach((f, i) => setTimeout(() => play(f, 1.6), i * 400))
  }

  return { play, chime }
}

function MeditateCard({ state, onUpdate }) {
  const { meditate } = state.anchors
  const [active,   setActive]   = useState(false)
  const [paused,   setPaused]   = useState(false)
  const [duration, setDuration] = useState(10)
  const [secsLeft, setSecsLeft] = useState(10 * 60)
  const [phase,    setPhase]    = useState('hold-out')
  const [soundOn,  setSoundOn]  = useState(true)

  const timerRef    = useRef(null)
  const breathRef   = useRef(null)
  const soundRef    = useRef(true)
  const onUpdateRef = useRef(onUpdate)
  soundRef.current    = soundOn
  onUpdateRef.current = onUpdate

  const { play, chime } = useTone()
  const tone = (freq) => { if (soundRef.current) play(freq) }

  const stopTimer  = () => { clearInterval(timerRef.current); timerRef.current = null }
  const stopBreath = () => { clearTimeout(breathRef.current); breathRef.current = null }

  const runBreath = (idx = 0) => {
    const { name, ms, freq } = BREATH_PHASES[idx % BREATH_PHASES.length]
    setPhase(name)
    tone(freq)
    breathRef.current = setTimeout(() => runBreath(idx + 1), ms)
  }

  const startCountdown = (from) => {
    stopTimer()
    timerRef.current = setInterval(() => {
      setSecsLeft(s => {
        if (s <= 1) {
          stopTimer(); stopBreath()
          setActive(false); setPhase('hold-out')
          if (soundRef.current) setTimeout(chime, 80)
          onUpdateRef.current(p => ({ ...p, anchors: { ...p.anchors, meditate: { completed: true, duration } } }))
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  const start = () => {
    const secs = duration * 60
    setActive(true); setPaused(false); setSecsLeft(secs)
    runBreath(0); startCountdown(secs)
  }

  const pause = () => { setPaused(true); stopTimer(); stopBreath() }

  const resume = () => {
    setPaused(false)
    runBreath(0)          // restart breath cycle from "in"
    startCountdown(secsLeft)
  }

  const end = () => {
    stopTimer(); stopBreath()
    setActive(false); setPaused(false); setPhase('hold-out')
  }

  useEffect(() => () => { stopTimer(); stopBreath() }, [])

  const toggle = () => onUpdate(p => ({
    ...p,
    anchors: { ...p.anchors, meditate: { ...p.anchors.meditate, completed: !meditate.completed } },
  }))

  const expanded    = phase === 'in' || phase === 'hold-in'
  const phaseLabel  = { in: 'Breathe In', 'hold-in': 'Hold', out: 'Breathe Out', 'hold-out': 'Hold' }
  const phaseNote   = { in: '← inhale', 'hold-in': '← hold', out: '← exhale', 'hold-out': '← hold' }
  const mm          = String(Math.floor(secsLeft / 60)).padStart(2, '0')
  const ss          = String(secsLeft % 60).padStart(2, '0')
  const progress    = ((duration * 60 - secsLeft) / (duration * 60)) * 100

  const SoundBtn = () => (
    <button
      onClick={() => setSoundOn(s => !s)}
      title={soundOn ? 'Mute tones' : 'Enable tones'}
      className={`px-3 py-2 rounded-lg border text-sm transition-colors ${soundOn ? 'border-sage/25 text-sage/55' : 'border-mineral/15 text-mineral/25'}`}
    >
      {soundOn ? '🔔' : '🔕'}
    </button>
  )

  return (
    <AnchorCard icon={Brain} label="Meditate" completed={meditate.completed} onToggle={toggle}>
      {active ? (
        <div className="space-y-4">
          {/* Breathing circle */}
          <div className="flex flex-col items-center gap-2 pt-1 pb-1">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <div
                className="absolute rounded-full bg-sage/15 transition-all duration-[4000ms] ease-in-out"
                style={{ width: expanded ? '112px' : '44px', height: expanded ? '112px' : '44px' }}
              />
              <div
                className="absolute rounded-full bg-sage/28 transition-all duration-[4000ms] ease-in-out"
                style={{ width: expanded ? '76px' : '30px', height: expanded ? '76px' : '30px' }}
              />
              <Wind className="w-5 h-5 text-sage relative z-10" />
            </div>
            <p className="text-sage/80 text-sm tracking-[0.18em] uppercase font-medium">{phaseLabel[phase]}</p>
            <p className="text-mineral/30 text-xs tracking-widest">4 · 4 · 4 · 4</p>
          </div>

          {/* Countdown + progress */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sage text-2xl font-light tabular-nums">{mm}:{ss}</span>
              <span className="text-mineral/25 text-xs">{duration} min session</span>
            </div>
            <div className="h-0.5 bg-surface-dark/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-sage/40 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={paused ? resume : pause}
              className="flex-1 py-2 rounded-lg bg-sage/15 text-sage text-sm flex items-center justify-center gap-1.5 hover:bg-sage/25 transition-colors"
            >
              {paused
                ? <><Play className="w-3.5 h-3.5" /> Resume</>
                : <><Pause className="w-3.5 h-3.5" /> Pause</>}
            </button>
            <button
              onClick={end}
              className="px-4 py-2 rounded-lg border border-mineral/15 text-mineral/40 text-xs hover:text-mineral/65 transition-colors"
            >
              End
            </button>
            <SoundBtn />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-mineral/35 text-xs">Duration</span>
            {[5, 10, 15, 20, 30].map(d => (
              <button
                key={d}
                onClick={() => { setDuration(d); setSecsLeft(d * 60) }}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                  duration === d
                    ? 'bg-sage/20 border-sage/35 text-sage'
                    : 'border-mineral/18 text-mineral/40 hover:border-sage/30 hover:text-mineral/65'
                }`}
              >
                {d}m
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={start}
              className="flex-1 py-2 rounded-lg bg-sage/15 text-sage text-sm flex items-center justify-center gap-1.5 hover:bg-sage/25 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Start {duration} min
            </button>
            <SoundBtn />
          </div>
          <p className="text-mineral/25 text-xs">Box breathing · audio cues signal each phase</p>
        </div>
      )}
    </AnchorCard>
  )
}

// ── TranceWidget ──────────────────────────────────────────────────────────────
function TranceWidget({ interval, onShowTrance, onChangeInterval }) {
  const [seconds, setSeconds] = useState(interval * 60)
  const [running, setRunning] = useState(false)
  const timerRef = useRef(null)
  const showRef  = useRef(onShowTrance)
  showRef.current = onShowTrance

  const clearTimer = () => { clearInterval(timerRef.current); timerRef.current = null }

  const resetTimer = (secs) => { clearTimer(); setRunning(false); setSeconds(secs ?? interval * 60) }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { resetTimer(interval * 60) }, [interval])
  useEffect(() => () => clearTimer(), [])

  const start = () => {
    clearTimer()
    setSeconds(interval * 60)
    setRunning(true)
    timerRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearTimer()
          setRunning(false)
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('AnchorSpace', { body: 'Time for a mindful break. Your work will wait.' })
          }
          showRef.current()
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  const totalSecs = interval * 60
  const progress  = ((totalSecs - seconds) / totalSecs) * 100
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')

  return (
    <div className="bg-card-dark rounded-2xl p-5 border border-mineral/10">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-surface-dark/60 flex items-center justify-center">
            <Clock className={`w-5 h-5 transition-colors ${running ? 'text-sage' : 'text-mineral/35'}`} />
          </div>
          <div>
            <p className="text-mineral/65 text-sm font-medium">Work Trance Breaker</p>
            <p className="text-mineral/30 text-xs mt-0.5">Auto-pauses you every {interval} min to breathe &amp; ground</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 mb-1">
        <select value={interval} onChange={e => onChangeInterval(+e.target.value)}
          className="bg-transparent text-mineral/40 text-xs border border-mineral/15 rounded-lg px-2 py-1 outline-none cursor-pointer">
          <option value={30}>30 min</option>
          <option value={45}>45 min</option>
          <option value={60}>60 min</option>
          <option value={90}>90 min</option>
        </select>
        <button onClick={() => onShowTrance()} className="text-mineral/25 text-xs hover:text-mineral/55 transition-colors px-2 py-1 rounded-lg border border-mineral/10 hover:border-mineral/25">
          preview break
        </button>
      </div>

      <div className="flex items-center gap-4 mt-3">
        <div className="flex-1">
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className={`text-3xl font-light tabular-nums tracking-tight transition-colors ${running ? 'text-sage' : 'text-mineral/30'}`}>
              {mins}:{secs}
            </span>
            <span className="text-mineral/25 text-xs">remaining</span>
          </div>
          <div className="h-1 bg-surface-dark/60 rounded-full overflow-hidden">
            <div className="h-full bg-sage/50 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={running ? () => { clearTimer(); setRunning(false) } : start}
            className="w-9 h-9 rounded-xl bg-sage/20 text-sage flex items-center justify-center hover:bg-sage/30 transition-colors">
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button onClick={() => resetTimer()}
            className="w-9 h-9 rounded-xl bg-surface-dark/60 text-mineral/35 flex items-center justify-center hover:text-mineral/65 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── HistoryGrid ───────────────────────────────────────────────────────────────
function HistoryGrid({ history }) {
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (27 - i))
    return d.toISOString().split('T')[0]
  })
  const today = getToday()
  const getCompleted = (v) => (typeof v === 'boolean' ? v : v?.completed ?? false)

  const getOpacity = (date) => {
    const e = history[date]
    if (!e) return 0
    return [e.workout, e.read, e.meditate, e.checkin].filter(getCompleted).length / 4
  }

  const getTooltip = (date) => {
    const e = history[date]
    if (!e) return date
    const count = [e.workout, e.read, e.meditate, e.checkin].filter(getCompleted).length
    const parts = [`${date} · ${count}/4`]
    const mood = e.checkin?.mood
    const dur  = e.meditate?.duration
    const done = e.workout?.doneCount
    const tot  = e.workout?.totalCount
    if (mood != null)             parts.push(`mood ${mood}/10`)
    if (dur  != null)             parts.push(`${dur}min meditation`)
    if (tot  != null && tot > 0)  parts.push(`${done}/${tot} exercises`)
    if (e.success)                parts.push(`"${e.success.slice(0, 40)}${e.success.length > 40 ? '…' : ''}"`)
    return parts.join(' · ')
  }

  return (
    <div>
      <p className="text-mineral/35 text-xs tracking-[0.2em] uppercase mb-3">28-Day View</p>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(date => {
          const op = getOpacity(date)
          const isToday = date === today
          return (
            <div key={date} title={getTooltip(date)}
              className={`w-full aspect-square rounded-md border flex items-center justify-center ${isToday ? 'border-sage/50' : 'border-mineral/15'}`}
              style={{ backgroundColor: op > 0 ? `rgba(143,158,139,${op * 0.65})` : 'transparent' }}>
              {isToday && <div className="w-1.5 h-1.5 rounded-full bg-sage" />}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-mineral/25 text-xs">4 weeks ago</span>
        <span className="text-mineral/25 text-xs">today</span>
      </div>
    </div>
  )
}

// ── LoginScreen ───────────────────────────────────────────────────────────────
function LoginScreen({ onAuth, onSkip }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const submit = async () => {
    if (!email || !password) return
    setLoading(true); setError(''); setMessage('')
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onAuth(data.user)
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user?.identities?.length === 0) setMessage('Already registered — please sign in.')
        else setMessage('Check your email for a confirmation link.')
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-surface-dark flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-sage/20 flex items-center justify-center mx-auto mb-4">
            <Wind className="w-7 h-7 text-sage" />
          </div>
          <h1 className="text-mineral text-2xl font-light tracking-wide">AnchorSpace</h1>
          <p className="text-mineral/35 text-sm mt-1">Your daily well-being companion</p>
        </div>

        <div className="space-y-3">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="Email"
            className="w-full bg-card-dark border border-mineral/15 rounded-xl px-4 py-3 text-mineral placeholder-mineral/25 text-sm focus:outline-none focus:border-sage/40 transition-colors" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="Password"
            className="w-full bg-card-dark border border-mineral/15 rounded-xl px-4 py-3 text-mineral placeholder-mineral/25 text-sm focus:outline-none focus:border-sage/40 transition-colors" />

          {error   && <p className="text-red-400/70 text-xs text-center px-2">{error}</p>}
          {message && <p className="text-sage/70 text-xs text-center px-2">{message}</p>}

          {hasSupabase ? (
            <button onClick={submit} disabled={loading}
              className="w-full py-3 rounded-xl bg-sage/20 text-sage text-sm tracking-wide hover:bg-sage/30 disabled:opacity-50 transition-colors">
              {loading ? '…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="bg-amber-950/40 border border-amber-700/30 rounded-xl p-3">
                <p className="text-amber-400/70 text-xs text-center">
                  Supabase not configured — running in local mode. Add keys to <code className="font-mono">.env</code> to enable cross-device sync.
                </p>
              </div>
              <button onClick={onSkip} className="w-full py-3 rounded-xl bg-sage/20 text-sage text-sm tracking-wide hover:bg-sage/30 transition-colors">
                Continue without account
              </button>
            </div>
          )}

          {hasSupabase && (
            <button onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}
              className="w-full text-center text-mineral/30 text-xs hover:text-mineral/60 transition-colors py-2">
              {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ state, onUpdate, user, onSignOut }) {
  const [showTrance,   setShowTrance]   = useState(false)
  const [showToday,    setShowToday]    = useState(false)
  const [showWeek,     setShowWeek]     = useState(false)
  const [showShutdown, setShowShutdown] = useState(false)
  const [showStuck,    setShowStuck]    = useState(false)
  const [trancePrompt] = useState(() => rand(GROUNDING_PROMPTS))

  const completedCount = [
    state.anchors.workout.completed,
    state.anchors.read.completed,
    state.anchors.meditate.completed,
    state.anchors.checkin.completed,
  ].filter(Boolean).length

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const saveToday = (text, exercises) => {
    onUpdate(prev => ({
      ...prev,
      workoutText: text,
      exercises,
      anchors: { ...prev.anchors, workout: { ...prev.anchors.workout, completed: false } },
    }))
    setShowToday(false)
  }

  const saveWeekPlan = (plan) => {
    const todayKey = DAY_KEYS[todayDayIdx()]
    const todayText = plan[todayKey] || ''
    const isRest = todayText === 'REST'
    const parsed  = isRest ? [] : parseWorkout(todayText)
    onUpdate(prev => ({
      ...prev,
      weekPlan: plan,
      workoutText: isRest ? '' : todayText,
      exercises: parsed,
      anchors: { ...prev.anchors, workout: isRest ? { completed: true, isRestDay: true } : { ...prev.anchors.workout } },
    }))
    setShowWeek(false)
  }

  const saveShutdown = (success) => {
    onUpdate(prev => ({
      ...prev,
      shutdown: { triggered: true, success },
      settings: { ...prev.settings, eveningMode: true },
    }))
    setShowShutdown(false)
  }

  const toggleAnchor = (key) => onUpdate(prev => ({
    ...prev,
    anchors: { ...prev.anchors, [key]: { ...prev.anchors[key], completed: !prev.anchors[key].completed } },
  }))

  return (
    <div className={`min-h-screen bg-surface-dark ${state.settings.eveningMode ? 'evening-mode' : ''}`}>
      <header className="sticky top-0 bg-surface-dark/90 backdrop-blur-sm z-10 border-b border-mineral/8">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-sage" />
              <span className="text-mineral/80 text-sm font-medium">AnchorSpace</span>
            </div>
            <p className="text-mineral/30 text-xs mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all duration-500 ${i < completedCount ? 'bg-sage' : 'bg-mineral/15'}`} />
              ))}
            </div>
            {user && (
              <button onClick={onSignOut} className="text-mineral/25 hover:text-mineral/55 transition-colors" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-3">
        {state.settings.eveningMode && (
          <div className="bg-sage/8 border border-sage/18 rounded-xl p-4 flex items-center gap-3">
            <Moon className="w-4 h-4 text-sage/55 flex-shrink-0" />
            <p className="text-sage/65 text-sm">Evening mode. You've done your part for today.</p>
          </div>
        )}

        <button onClick={() => setShowStuck(true)}
          className="w-full py-3 rounded-xl border border-dashed border-mineral/18 text-mineral/40 text-sm hover:border-sage/40 hover:text-sage/80 transition-colors flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" />
          I'm stuck / overwhelmed
        </button>

        <WorkoutCard
          state={state}
          onUpdate={onUpdate}
          onOpenToday={() => setShowToday(true)}
          onOpenWeek={() => setShowWeek(true)}
        />

        <AnchorCard icon={BookOpen} label="Read" completed={state.anchors.read.completed} onToggle={() => toggleAnchor('read')}>
          <p className="text-mineral/30 text-xs">Any book, article, or paper. Just read.</p>
        </AnchorCard>

        <MeditateCard state={state} onUpdate={onUpdate} />

        <CheckinCard state={state} onUpdate={onUpdate} />

        <TranceWidget
          interval={state.settings.tranceInterval}
          onShowTrance={() => setShowTrance(true)}
          onChangeInterval={mins => onUpdate(prev => ({ ...prev, settings: { ...prev.settings, tranceInterval: mins } }))}
        />

        <div className="bg-card-dark rounded-2xl p-5 border border-mineral/10">
          <HistoryGrid history={state.history} />
        </div>

        {!state.settings.eveningMode && (
          <button onClick={() => setShowShutdown(true)}
            className="w-full py-3 rounded-xl border border-mineral/12 text-mineral/35 text-sm hover:border-sage/30 hover:text-sage/65 transition-colors flex items-center justify-center gap-2">
            <Moon className="w-4 h-4" />
            Begin Shutdown Ritual
          </button>
        )}

        <div className="h-6" />
      </main>

      {showTrance   && <WorkTranceOverlay prompt={trancePrompt} onDismiss={() => setShowTrance(false)} />}
      {showToday    && <WorkoutParserModal state={state} onSave={saveToday} onClose={() => setShowToday(false)} />}
      {showWeek     && <WeekPlannerModal weekPlan={state.weekPlan} onSave={saveWeekPlan} onClose={() => setShowWeek(false)} />}
      {showShutdown && <ShutdownModal state={state} onSave={saveShutdown} onClose={() => setShowShutdown(false)} />}
      {showStuck    && <StuckModal onClose={() => setShowStuck(false)} />}
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user,     setUser]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [appState, setAppState] = useState(DEFAULT_STATE)
  const syncRef = useRef(null)

  const maybeReset = (state) => {
    const today = getToday()
    if (state.lastDate === today) return state
    const { anchors, lastDate, history, weekPlan } = state
    const nonHeaderEx = (state.exercises || []).filter(ex => !ex.isHeader)
    const dayEntry = {
      workout: {
        completed: anchors.workout.completed || anchors.workout.isRestDay,
        isRestDay: anchors.workout.isRestDay,
        exercises: nonHeaderEx.map(ex => ({ name: ex.exercise, done: ex.completed })),
        doneCount: nonHeaderEx.filter(ex => ex.completed).length,
        totalCount: nonHeaderEx.length,
      },
      read: {
        completed: anchors.read.completed,
      },
      meditate: {
        completed: anchors.meditate.completed,
        duration:  anchors.meditate.duration || null,
      },
      checkin: {
        completed: anchors.checkin.completed,
        mood:      anchors.checkin.mood,
      },
      success: state.shutdown?.success || '',
    }
    const todayKey  = DAY_KEYS[todayDayIdx()]
    const todayText = (weekPlan || {})[todayKey] || ''
    const isRest    = todayText === 'REST'
    const parsed    = isRest ? [] : (todayText ? parseWorkout(todayText) : state.exercises.map(ex => ({ ...ex, completed: false })))
    return {
      ...DEFAULT_STATE,
      history:     { ...history, [lastDate]: dayEntry },
      weekPlan:    weekPlan || { ...EMPTY_WEEK },
      workoutText: isRest ? '' : (todayText || state.workoutText),
      exercises:   parsed,
      settings:    { ...state.settings, eveningMode: false },
      anchors: {
        ...DEFAULT_STATE.anchors,
        workout: isRest ? { completed: true, isRestDay: true } : DEFAULT_STATE.anchors.workout,
      },
    }
  }

  const loadLocal = () => {
    try {
      const saved = localStorage.getItem('anchorspace')
      if (saved) setAppState(maybeReset({ ...DEFAULT_STATE, ...JSON.parse(saved) }))
    } catch {}
  }

  const loadProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('app_state').eq('id', userId).single()
    if (data?.app_state) setAppState(maybeReset({ ...DEFAULT_STATE, ...data.app_state }))
    setLoading(false)
  }

  useEffect(() => {
    if (!hasSupabase) { loadLocal(); setLoading(false); return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); loadProfile(session.user.id) }
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) { setUser(session.user); if (event === 'SIGNED_IN') loadProfile(session.user.id) }
      else { setUser(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (loading) return
    clearTimeout(syncRef.current)
    syncRef.current = setTimeout(async () => {
      if (user && hasSupabase) {
        await supabase.from('profiles').upsert({ id: user.id, updated_at: new Date().toISOString(), app_state: appState })
      } else if (!hasSupabase) {
        localStorage.setItem('anchorspace', JSON.stringify(appState))
      }
    }, 600)
    return () => clearTimeout(syncRef.current)
  }, [appState, user, loading])

  useEffect(() => {
    const id = setInterval(() => setAppState(prev => maybeReset(prev)), 60_000)
    return () => clearInterval(id)
  }, [])

  const signOut = async () => {
    if (hasSupabase) await supabase.auth.signOut()
    setUser(null); setAppState(DEFAULT_STATE)
  }

  if (loading) return (
    <div className="min-h-screen bg-surface-dark flex items-center justify-center">
      <Wind className="w-8 h-8 text-sage/40 animate-pulse" />
    </div>
  )

  if (!user && hasSupabase)  return <LoginScreen onAuth={setUser} onSkip={() => {}} />
  if (!user && !hasSupabase) return <LoginScreen onAuth={() => {}} onSkip={() => setUser({ id: 'local', email: 'local' })} />

  return <Dashboard state={appState} onUpdate={setAppState} user={hasSupabase ? user : null} onSignOut={signOut} />
}
