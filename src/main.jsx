import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Apple,
  Bell,
  CalendarCheck,
  Check,
  ChevronRight,
  Dumbbell,
  FileDown,
  FileUp,
  Flame,
  Gauge,
  HeartPulse,
  Home,
  LogOut,
  Plus,
  Scale,
  Sparkles,
  Trash2,
  Utensils,
  Weight
} from "lucide-react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { exercises } from "./data/exercises";
import { auth, db, firebaseReady, googleProvider } from "./firebase";
import "./styles.css";

const storageKey = "journeyfit-react-state";
const today = toDateKey(new Date());
const foodEstimates = {
  apple: 95,
  banana: 105,
  egg: 78,
  "greek yogurt": 130,
  oatmeal: 150,
  "chicken breast": 165,
  salmon: 208,
  rice: 205,
  "protein shake": 180,
  "avocado toast": 260,
  "chicken bowl": 520,
  "caesar salad": 470,
  "turkey sandwich": 360,
  smoothie: 280
};

const starterState = {
  settings: {
    goalWeight: "",
    weightUnit: "lb",
    calorieTarget: 1800,
    proteinTarget: 120,
    waterTarget: 8,
    notificationsEnabled: false
  },
  weights: [],
  foods: [],
  workouts: [],
  habits: [
    { id: id(), name: "Drink water", completions: {} },
    { id: id(), name: "Hit protein goal", completions: {} },
    { id: id(), name: "Walk 8,000 steps", completions: {} }
  ]
};

const views = [
  { id: "dashboard", label: "Today", icon: Home },
  { id: "weight", label: "Weight", icon: Scale },
  { id: "food", label: "Food", icon: Utensils },
  { id: "workouts", label: "Training", icon: Dumbbell },
  { id: "habits", label: "Habits", icon: CalendarCheck }
];

const metTable = {
  Strength: { Easy: 3.5, Moderate: 5, Hard: 6 },
  Cardio: { Easy: 5, Moderate: 7, Hard: 9 },
  Walking: { Easy: 2.8, Moderate: 3.8, Hard: 5 },
  Yoga: { Easy: 2.5, Moderate: 3, Hard: 4 },
  Sport: { Easy: 5, Moderate: 7, Hard: 10 },
  Other: { Easy: 3, Moderate: 5, Hard: 7 }
};

function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [state, setState, authState] = usePersistentState();
  const fileInput = useRef(null);
  const model = useMemo(() => buildModel(state), [state]);
  useServiceWorker();
  useHabitNotifications(state);

  function update(mutator) {
    setState((current) => {
      const next = structuredClone(current);
      mutator(next);
      return next;
    });
  }

  return (
    <div className="app">
      <Sidebar activeView={activeView} setActiveView={setActiveView} settings={state.settings} update={update} model={model} />
      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{formatLongDate(today)}</p>
            <h1>{activeView === "dashboard" ? "Your daily progress" : views.find((view) => view.id === activeView)?.label}</h1>
          </div>
          <div className="top-actions">
            <AuthButton authState={authState} />
            <button className="icon-button text-button" type="button" onClick={() => exportData(state)}>
              <FileDown size={18} />
              Export
            </button>
            <button className="icon-button text-button" type="button" onClick={() => fileInput.current.click()}>
              <FileUp size={18} />
              Import
            </button>
            <input
              ref={fileInput}
              hidden
              type="file"
              accept="application/json"
              onChange={(event) => importData(event, setState)}
            />
          </div>
        </header>

        {activeView === "dashboard" && <Dashboard model={model} state={state} update={update} />}
        {activeView === "weight" && <WeightView state={state} update={update} model={model} />}
        {activeView === "food" && <FoodView state={state} update={update} model={model} />}
        {activeView === "workouts" && <WorkoutView state={state} update={update} model={model} />}
        {activeView === "habits" && <HabitView state={state} update={update} />}
      </main>
    </div>
  );
}

function Sidebar({ activeView, setActiveView, settings, update, model }) {
  const unit = settings.weightUnit || "lb";

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <HeartPulse size={22} />
        </div>
        <div>
          <strong>JourneyFit</strong>
          <span>Personal metabolism journal</span>
        </div>
      </div>

      <nav className="nav">
        {views.map(({ id: viewId, label, icon: Icon }) => (
          <button
            className={activeView === viewId ? "nav-item active" : "nav-item"}
            key={viewId}
            type="button"
            onClick={() => setActiveView(viewId)}
          >
            <Icon size={19} />
            <span>{label}</span>
            <ChevronRight className="nav-chevron" size={16} />
          </button>
        ))}
      </nav>

      <div className="coach-panel">
        <Sparkles size={18} />
        <div>
          <strong>Steady pace</strong>
          <span>Small logs compound into visible direction.</span>
        </div>
      </div>

      <div className="burn-card">
        <Flame size={18} />
        <div>
          <span>Est. burned today</span>
          <strong>{model.todayBurnEstimate == null ? "--" : `${model.todayBurnEstimate.toLocaleString()} kcal`}</strong>
        </div>
      </div>

      <label className="field dark-field">
        Goal weight
        <div className="unit-input">
          <input
            type="number"
            min="1"
            step="0.1"
            value={settings.goalWeight ? toDisplayWeight(settings.goalWeight, unit) : ""}
            onChange={(event) => update((draft) => { draft.settings.goalWeight = toStoredWeight(event.target.value, unit) || ""; })}
          />
          <span>{unit}</span>
        </div>
      </label>

      <div className="unit-switch" aria-label="Weight unit">
        {["lb", "kg"].map((option) => (
          <button
            className={unit === option ? "active" : ""}
            key={option}
            type="button"
            onClick={() => update((draft) => { draft.settings.weightUnit = option; })}
          >
            {option}
          </button>
        ))}
      </div>
    </aside>
  );
}

function AuthButton({ authState }) {
  if (!firebaseReady) {
    return (
      <button className="icon-button text-button auth-button" type="button" disabled>
        Google sign-in off
      </button>
    );
  }

  if (authState.loading) {
    return (
      <button className="icon-button text-button auth-button" type="button" disabled>
        Syncing...
      </button>
    );
  }

  if (authState.user) {
    return (
      <div className="account-menu">
        <span>{authState.user.displayName || authState.user.email}</span>
        <button className="icon-button text-button" type="button" onClick={() => signOut(auth)}>
          <LogOut size={17} />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button className="icon-button text-button auth-button" type="button" onClick={() => signInWithPopup(auth, googleProvider)}>
      Continue with Google
    </button>
  );
}

function Dashboard({ model, state, update }) {
  const unit = state.settings.weightUnit || "lb";

  return (
    <div className="view-grid">
      <section className="hero-band">
        <div>
          <p className="eyebrow">Momentum</p>
          <h2>{model.currentWeight ? formatWeight(model.currentWeight.weight, unit) : "Start with one log"}</h2>
          <p>{model.weightSummary}</p>
        </div>
        <div className="hero-metrics">
          <Metric icon={Flame} label="Calories today" value={model.todayCalories.toLocaleString()} detail={`${model.caloriesLeft.toLocaleString()} left`} />
          <Metric icon={Dumbbell} label="Training this week" value={`${model.weekMinutes}`} detail="minutes" />
          <Metric icon={Check} label="Habits today" value={`${model.habitCompletion}%`} detail={`${model.completedHabits}/${state.habits.length || 0} complete`} />
        </div>
      </section>

      <section className="panel wide">
        <PanelHeader title="Progress curve" detail="Goal progress percentage with calories across the last 21 days" />
        <div className="chart tall-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={model.timeline}>
              <defs>
                <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0c3c61" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#0c3c61" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#d8e9f4" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={2} minTickGap={24} tickMargin={12} height={42} />
              <YAxis yAxisId="progress" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} width={52} tickMargin={8} />
              <YAxis yAxisId="calories" orientation="right" tickLine={false} axisLine={false} width={54} tickMargin={8} />
              <Tooltip content={<ChartTooltip unit={unit} />} />
              <Bar yAxisId="calories" dataKey="calories" fill="#aee6ff" radius={[6, 6, 0, 0]} />
              <Area yAxisId="progress" name="Progress" type="monotone" dataKey="progress" stroke="#0c3c61" strokeWidth={3} fill="url(#weightFill)" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="Daily targets" detail="Tune the dashboard feedback" />
        <SettingsGrid settings={state.settings} update={update} />
      </section>

      <section className="panel">
        <PanelHeader title="Today log" detail="What is already captured" />
        <TodayStack model={model} />
      </section>
    </div>
  );
}

function WeightView({ state, update, model }) {
  const [form, setForm] = useState({ date: today, weight: "", note: "" });
  const unit = state.settings.weightUnit || "lb";

  function submit(event) {
    event.preventDefault();
    update((draft) => {
      draft.weights.push({ id: id(), date: form.date, weight: toStoredWeight(form.weight, unit), note: form.note });
    });
    setForm({ date: today, weight: "", note: "" });
  }

  return (
    <div className="view-grid">
      <section className="panel form-panel">
        <PanelHeader title="Log weight" detail="Scale weight, notes, and trend context" />
        <form className="entry-form weight-form" onSubmit={submit}>
          <Input label="Date" type="date" value={form.date} onChange={(date) => setForm({ ...form, date })} required />
          <Input label="Weight" type="number" value={form.weight} onChange={(weight) => setForm({ ...form, weight })} required suffix={unit} />
          <Input label="Note" value={form.note} onChange={(note) => setForm({ ...form, note })} placeholder="Sleep, soreness, travel..." />
          <button className="primary-button" type="submit"><Plus size={18} /> Add weight</button>
        </form>
      </section>

      <section className="panel wide">
        <PanelHeader title="Weight analytics" detail={model.weightSummary} />
        <div className="chart medium-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={model.timeline}>
              <CartesianGrid stroke="#d8e9f4" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={2} minTickGap={24} tickMargin={12} height={42} />
              <YAxis domain={["dataMin - 3", "dataMax + 3"]} tickLine={false} axisLine={false} width={52} tickMargin={8} />
              <Tooltip content={<ChartTooltip unit={unit} />} />
              <Line type="monotone" dataKey="weight" stroke="#0c3c61" strokeWidth={3} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <DataTable
        title="Weight history"
        columns={["Date", "Weight", "Note", ""]}
        rows={sortByDate(state.weights).map((entry) => [
          formatDate(entry.date),
          formatWeight(entry.weight, unit),
          entry.note || "-",
          <DeleteButton onClick={() => update((draft) => removeById(draft.weights, entry.id))} />
        ])}
      />
    </div>
  );
}

function FoodView({ state, update, model }) {
  const [form, setForm] = useState({
    date: today,
    meal: "Breakfast",
    name: "",
    servings: 1,
    calories: "",
    protein: "",
    carbs: "",
    fat: ""
  });

  function updateFoodName(name) {
    const estimate = foodEstimates[name.toLowerCase()];
    setForm({ ...form, name, calories: estimate ? Math.round(estimate) : form.calories });
  }

  function submit(event) {
    event.preventDefault();
    const servings = Number(form.servings) || 1;
    update((draft) => {
      draft.foods.push({
        id: id(),
        date: form.date,
        meal: form.meal,
        name: form.name,
        servings,
        calories: Math.round((Number(form.calories) || 0) * servings),
        protein: roundMacro((Number(form.protein) || 0) * servings),
        carbs: roundMacro((Number(form.carbs) || 0) * servings),
        fat: roundMacro((Number(form.fat) || 0) * servings)
      });
    });
    setForm({ date: today, meal: "Breakfast", name: "", servings: 1, calories: "", protein: "", carbs: "", fat: "" });
  }

  return (
    <div className="view-grid">
      <section className="panel form-panel wide">
        <PanelHeader title="Log food" detail="Values are per serving; saved totals use your serving count" />
        <form className="entry-form food-form" onSubmit={submit}>
          <Input label="Date" type="date" value={form.date} onChange={(date) => setForm({ ...form, date })} required />
          <Select label="Meal" value={form.meal} onChange={(meal) => setForm({ ...form, meal })} options={["Breakfast", "Lunch", "Dinner", "Snack"]} />
          <label className="field food-name-field">
            Food
            <input list="food-options" value={form.name} onChange={(event) => updateFoodName(event.target.value)} required placeholder="Chicken bowl" />
            <datalist id="food-options">{Object.keys(foodEstimates).map((food) => <option key={food} value={titleCase(food)} />)}</datalist>
          </label>
          <Input label="Servings" type="number" value={form.servings} onChange={(servings) => setForm({ ...form, servings })} required />
          <Input label="Calories / serving" type="number" value={form.calories} onChange={(calories) => setForm({ ...form, calories })} />
          <Input label="Protein" type="number" value={form.protein} onChange={(protein) => setForm({ ...form, protein })} suffix="g" />
          <Input label="Carbs" type="number" value={form.carbs} onChange={(carbs) => setForm({ ...form, carbs })} suffix="g" />
          <Input label="Fat" type="number" value={form.fat} onChange={(fat) => setForm({ ...form, fat })} suffix="g" />
          <button className="primary-button" type="submit"><Plus size={18} /> Add food</button>
        </form>
      </section>

      <section className="panel">
        <PanelHeader title="Intake mix" detail="Today by meal" />
        <div className="chart small-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={model.mealBreakdown}>
              <XAxis dataKey="meal" tickLine={false} axisLine={false} tickMargin={12} height={42} />
              <YAxis tickLine={false} axisLine={false} width={46} tickMargin={8} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="calories" radius={[6, 6, 0, 0]}>
                {model.mealBreakdown.map((_, index) => <Cell key={index} fill={["#082f4e", "#aee6ff", "#0c3c61", "#f6a35f"][index % 4]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="Nutrition targets" detail="Today" />
        <ProgressRows rows={[
          ["Calories", model.todayCalories, state.settings.calorieTarget, "kcal"],
          ["Protein", model.todayProtein, state.settings.proteinTarget, "g"]
        ]} />
      </section>

      <DataTable
        title="Food history"
        columns={["Date", "Meal", "Food", "Servings", "Calories", "Protein", "Carbs", "Fat", ""]}
        rows={sortByDate(state.foods).map((entry) => [
          formatDate(entry.date),
          entry.meal,
          entry.name,
          entry.servings,
          entry.calories.toLocaleString(),
          `${entry.protein || 0}g`,
          `${entry.carbs || 0}g`,
          `${entry.fat || 0}g`,
          <DeleteButton onClick={() => update((draft) => removeById(draft.foods, entry.id))} />
        ])}
      />
    </div>
  );
}

function WorkoutView({ state, update, model }) {
  const [form, setForm] = useState({ date: today, exerciseName: "", type: "Strength", duration: "", intensity: "Moderate", notes: "" });
  const [exerciseQuery, setExerciseQuery] = useState("");
  const exerciseResults = useMemo(() => {
    const query = exerciseQuery.trim().toLowerCase();
    if (query.length < 2) return [];
    return exercises
      .filter((exercise) => [
        exercise.name,
        exercise.category,
        exercise.equipment,
        exercise.level,
        ...(exercise.primaryMuscles || [])
      ].join(" ").toLowerCase().includes(query))
      .slice(0, 8);
  }, [exerciseQuery]);

  function submit(event) {
    event.preventDefault();
    update((draft) => {
      draft.workouts.push({ id: id(), ...form, duration: Number(form.duration) });
    });
    setForm({ date: today, exerciseName: "", type: "Strength", duration: "", intensity: "Moderate", notes: "" });
    setExerciseQuery("");
  }

  function selectExercise(exercise) {
    const muscles = (exercise.primaryMuscles || []).join(", ");
    setForm({
      ...form,
      exerciseName: exercise.name,
      type: titleCase(exercise.category || "strength"),
      notes: form.notes || [exercise.equipment, muscles].filter(Boolean).join(" · ")
    });
    setExerciseQuery(exercise.name);
  }

  return (
    <div className="view-grid">
      <section className="panel wide">
        <PanelHeader title="Exercise picker" detail="Search the local exercise database and tap one to fill your workout" />
        <Input label="Search exercise" value={exerciseQuery} onChange={setExerciseQuery} placeholder="Bench press, squat, yoga, treadmill..." />
        {exerciseQuery.trim().length >= 2 && (
          <div className="exercise-results">
            {exerciseResults.length ? exerciseResults.map((exercise) => (
              <button className="exercise-result" key={exercise.id} type="button" onClick={() => selectExercise(exercise)}>
                <strong>{exercise.name}</strong>
                <span>{[titleCase(exercise.category || "exercise"), exercise.equipment, exercise.level, (exercise.primaryMuscles || []).join(", ")].filter(Boolean).join(" · ")}</span>
              </button>
            )) : <p className="search-empty">No exercises found.</p>}
          </div>
        )}
      </section>

      <section className="panel form-panel wide">
        <PanelHeader title="Log workout" detail="Capture training volume without friction" />
        <form className="entry-form workout-form" onSubmit={submit}>
          <Input label="Date" type="date" value={form.date} onChange={(date) => setForm({ ...form, date })} required />
          <Input label="Exercise" value={form.exerciseName} onChange={(exerciseName) => setForm({ ...form, exerciseName })} placeholder="Selected exercise" />
          <Select label="Type" value={form.type} onChange={(type) => setForm({ ...form, type })} options={["Strength", "Cardio", "Walking", "Yoga", "Sport", "Other"]} />
          <Input label="Duration" type="number" value={form.duration} onChange={(duration) => setForm({ ...form, duration })} suffix="min" required />
          <Select label="Intensity" value={form.intensity} onChange={(intensity) => setForm({ ...form, intensity })} options={["Easy", "Moderate", "Hard"]} />
          <Input label="Notes" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} placeholder="Upper body, treadmill..." />
          <button className="primary-button" type="submit"><Plus size={18} /> Add workout</button>
        </form>
      </section>

      <section className="panel">
        <PanelHeader title="Weekly load" detail={`${model.weekMinutes} minutes this week`} />
        <div className="training-ring">
          <Gauge size={54} />
          <strong>{model.weekMinutes}</strong>
          <span>minutes</span>
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="Workout types this week" detail="Last 7 days" />
        <WorkoutTypeList items={model.weekWorkoutTypes} max={model.topWeekWorkoutMinutes} />
      </section>

      <DataTable
        title="Workout history"
        columns={["Date", "Exercise", "Type", "Minutes", "Intensity", "Notes", ""]}
        rows={sortByDate(state.workouts).map((entry) => [
          formatDate(entry.date),
          entry.exerciseName || "-",
          entry.type,
          entry.duration,
          entry.intensity,
          entry.notes || "-",
          <DeleteButton onClick={() => update((draft) => removeById(draft.workouts, entry.id))} />
        ])}
      />
    </div>
  );
}

function HabitView({ state, update }) {
  const [name, setName] = useState("");
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(today, index - 6));
  const notificationsSupported = typeof window !== "undefined" && "Notification" in window;
  const permission = notificationsSupported ? Notification.permission : "unsupported";

  function addHabit(event) {
    event.preventDefault();
    update((draft) => {
      draft.habits.push({ id: id(), name, completions: {}, reminderTime: "" });
    });
    setName("");
  }

  async function enableNotifications() {
    if (!notificationsSupported) return;
    const result = await Notification.requestPermission();
    update((draft) => {
      draft.settings.notificationsEnabled = result === "granted";
    });
  }

  return (
    <div className="view-grid">
      <section className="panel form-panel">
        <PanelHeader title="Daily habits" detail="One checkbox per day" />
        <div className="notification-card">
          <div>
            <Bell size={18} />
            <div>
              <strong>Habit reminders</strong>
              <span>{notificationStatusText(permission, state.settings.notificationsEnabled)}</span>
            </div>
          </div>
          <button className="text-button icon-button" type="button" onClick={enableNotifications} disabled={!notificationsSupported || permission === "denied"}>
            <Bell size={17} />
            Enable
          </button>
        </div>
        <form className="inline-form" onSubmit={addHabit}>
          <Input label="New habit" value={name} onChange={setName} required placeholder="Evening walk" />
          <button className="primary-button" type="submit"><Plus size={18} /> Add habit</button>
        </form>
        <div className="habit-stack">
          {state.habits.map((habit) => (
            <div className="habit-card" key={habit.id}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={Boolean(habit.completions[today])}
                  onChange={(event) => update((draft) => {
                    const item = draft.habits.find((candidate) => candidate.id === habit.id);
                    item.completions[today] = event.target.checked;
                  })}
                />
                <span>{habit.name}</span>
              </label>
              <label className="field reminder-field">
                Reminder
                <input
                  type="time"
                  value={habit.reminderTime || ""}
                  onChange={(event) => update((draft) => {
                    const item = draft.habits.find((candidate) => candidate.id === habit.id);
                    item.reminderTime = event.target.value;
                  })}
                />
              </label>
              <DeleteButton onClick={() => update((draft) => removeById(draft.habits, habit.id))} />
            </div>
          ))}
        </div>
      </section>

      <section className="panel wide">
        <PanelHeader title="Habit board" detail="Last 7 days" />
        <div className="habit-board">
          <table>
            <thead>
              <tr>
                <th>Habit</th>
                {days.map((day) => <th key={day}>{shortDay(day)}</th>)}
              </tr>
            </thead>
            <tbody>
              {state.habits.map((habit) => (
                <tr key={habit.id}>
                  <td>{habit.name}</td>
                  {days.map((day) => (
                    <td key={day}>
                      <input
                        type="checkbox"
                        checked={Boolean(habit.completions[day])}
                        onChange={(event) => update((draft) => {
                          const item = draft.habits.find((candidate) => candidate.id === habit.id);
                          item.completions[day] = event.target.checked;
                        })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <article className="metric">
      <Icon size={20} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function PanelHeader({ title, detail }) {
  return (
    <div className="panel-header">
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function SettingsGrid({ settings, update }) {
  return (
    <div className="settings-grid">
      <Input label="Calories" type="number" value={settings.calorieTarget} onChange={(value) => update((draft) => { draft.settings.calorieTarget = Number(value); })} suffix="kcal" />
      <Input label="Protein" type="number" value={settings.proteinTarget} onChange={(value) => update((draft) => { draft.settings.proteinTarget = Number(value); })} suffix="g" />
      <Input label="Water" type="number" value={settings.waterTarget} onChange={(value) => update((draft) => { draft.settings.waterTarget = Number(value); })} suffix="cups" />
    </div>
  );
}

function TodayStack({ model }) {
  const rows = [
    [Apple, "Food entries", `${model.todayFoodCount}`, `${model.todayCalories.toLocaleString()} kcal`],
    [Activity, "Workouts", `${model.todayWorkoutCount}`, `${model.todayWorkoutMinutes} min`],
    [Weight, "Latest weight", model.currentWeight ? formatWeight(model.currentWeight.weight, model.weightUnit) : "No log", model.currentWeight?.note || "Scale trend"]
  ];
  return (
    <div className="today-stack">
      {rows.map(([Icon, label, value, detail]) => (
        <div className="today-row" key={label}>
          <Icon size={18} />
          <div>
            <strong>{label}</strong>
            <span>{detail}</span>
          </div>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}

function ProgressRows({ rows }) {
  return (
    <div className="progress-rows">
      {rows.map(([label, value, max, unit]) => <ProgressPill key={label} label={label} value={value} max={max || 1} unit={unit} />)}
    </div>
  );
}

function ProgressPill({ label, value, max, unit = "min" }) {
  const percent = Math.min((Number(value) / Number(max || 1)) * 100, 100);
  return (
    <div className="progress-pill">
      <div>
        <span>{label}</span>
        <strong>{Number(value).toLocaleString()} {unit}</strong>
      </div>
      <div className="progress-track"><i style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function WorkoutTypeList({ items, max }) {
  if (!items.length) {
    return (
      <div className="empty-panel">
        <Dumbbell size={22} />
        <span>No workouts logged for this period.</span>
      </div>
    );
  }

  return (
    <div className="type-list">
      {items.map((item) => <ProgressPill key={item.type} label={item.type} value={item.minutes} max={max} />)}
    </div>
  );
}

function DataTable({ title, columns, rows }) {
  return (
    <section className="panel table-panel wide">
      <PanelHeader title={title} detail={rows.length ? `${rows.length} entries` : "No entries yet"} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, rowIndex) => (
              <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
            )) : (
              <tr><td colSpan={columns.length} className="empty-cell">No entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Input({ label, suffix, onChange, ...props }) {
  return (
    <label className="field">
      {label}
      <div className={suffix ? "unit-input" : ""}>
        <input {...props} onChange={(event) => onChange(event.target.value)} />
        {suffix && <span>{suffix}</span>}
      </div>
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="field">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function DeleteButton({ onClick }) {
  return (
    <button className="delete-button" type="button" onClick={onClick} aria-label="Delete entry">
      <Trash2 size={16} />
    </button>
  );
}

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.dataKey}>{item.name || item.dataKey}: {formatTooltipValue(item, unit)}</span>
      ))}
    </div>
  );
}

function buildModel(state) {
  const unit = state.settings.weightUnit || "lb";
  const weightsByDate = mapLatestByDate(state.weights, "weight");
  const sortedWeights = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const firstWeight = sortedWeights[0];
  const currentWeight = sortedWeights.at(-1);
  const goalWeight = Number(state.settings.goalWeight) || 0;
  const timeline = Array.from({ length: 21 }, (_, index) => {
    const date = shiftDate(today, index - 20);
    const foods = state.foods.filter((food) => food.date === date);
    const storedWeight = weightsByDate[date];
    return {
      date,
      label: shortDay(date),
      weight: storedWeight ? toDisplayWeight(storedWeight, unit) : null,
      progress: calculateProgress(firstWeight?.weight, storedWeight, goalWeight),
      calories: sum(foods, "calories"),
      protein: sum(foods, "protein")
    };
  });

  const change = firstWeight && currentWeight ? toDisplayWeight(currentWeight.weight - firstWeight.weight, unit) : 0;
  const todayFoods = state.foods.filter((food) => food.date === today);
  const todayWorkouts = state.workouts.filter((workout) => workout.date === today);
  const todayBurnEstimate = currentWeight
    ? Math.round(sumWorkoutCalories(todayWorkouts, currentWeight.weight))
    : null;
  const weekStart = shiftDate(today, -6);
  const weekWorkouts = state.workouts.filter((workout) => workout.date >= weekStart);
  const completedHabits = state.habits.filter((habit) => habit.completions[today]).length;
  const mealBreakdown = ["Breakfast", "Lunch", "Dinner", "Snack"].map((meal) => ({
    meal,
    calories: sum(todayFoods.filter((food) => food.meal === meal), "calories")
  }));
  const weekWorkoutTypes = groupWorkoutTypes(weekWorkouts);

  return {
    timeline,
    weightUnit: unit,
    currentWeight,
    todayCalories: sum(todayFoods, "calories"),
    todayProtein: sum(todayFoods, "protein"),
    todayFoodCount: todayFoods.length,
    todayWorkoutCount: todayWorkouts.length,
    todayWorkoutMinutes: sum(todayWorkouts, "duration"),
    todayBurnEstimate,
    weekMinutes: sum(weekWorkouts, "duration"),
    completedHabits,
    habitCompletion: state.habits.length ? Math.round((completedHabits / state.habits.length) * 100) : 0,
    caloriesLeft: Math.max((Number(state.settings.calorieTarget) || 0) - sum(todayFoods, "calories"), 0),
    mealBreakdown,
    weekWorkoutTypes,
    topWeekWorkoutMinutes: Math.max(...weekWorkoutTypes.map((item) => item.minutes), 1),
    weightSummary: currentWeight
      ? `${change <= 0 ? "" : "+"}${change.toFixed(1)} ${unit} from your first logged weight`
      : "Log your first weight to start the trend"
  };
}

function usePersistentState() {
  const [state, setState] = useState(() => {
    try {
      return mergeState(JSON.parse(localStorage.getItem(storageKey)));
    } catch {
      return starterState;
    }
  });
  const [authState, setAuthState] = useState({
    user: null,
    loading: firebaseReady,
    syncing: false,
    error: ""
  });
  const userRef = useRef(null);
  const cloudReadyRef = useRef(!firebaseReady);
  const latestStateRef = useRef(state);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!firebaseReady) return undefined;

    return onAuthStateChanged(auth, async (user) => {
      userRef.current = user;
      cloudReadyRef.current = false;

      if (!user) {
        cloudReadyRef.current = true;
        setAuthState({ user: null, loading: false, syncing: false, error: "" });
        return;
      }

      setAuthState({ user, loading: false, syncing: true, error: "" });

      try {
        const stateRef = doc(db, "users", user.uid, "journeyfit", "state");
        const snapshot = await getDoc(stateRef);

        if (snapshot.exists() && snapshot.data()?.state) {
          const cloudState = mergeState(snapshot.data().state);
          latestStateRef.current = cloudState;
          localStorage.setItem(storageKey, JSON.stringify(cloudState));
          setState(cloudState);
        } else {
          await setDoc(stateRef, {
            state: latestStateRef.current,
            updatedAt: serverTimestamp()
          });
        }

        cloudReadyRef.current = true;
        setAuthState({ user, loading: false, syncing: false, error: "" });
      } catch (error) {
        cloudReadyRef.current = true;
        setAuthState({ user, loading: false, syncing: false, error: error.message });
      }
    });
  }, []);

  function setAndStore(updater) {
    setState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      localStorage.setItem(storageKey, JSON.stringify(next));
      latestStateRef.current = next;
      if (firebaseReady && userRef.current && cloudReadyRef.current) {
        const stateRef = doc(db, "users", userRef.current.uid, "journeyfit", "state");
        setDoc(stateRef, {
          state: next,
          updatedAt: serverTimestamp()
        }).catch(() => {});
      }
      return next;
    });
  }

  return [state, setAndStore, authState];
}

function useServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    }
  }, []);
}

function useHabitNotifications(state) {
  useEffect(() => {
    if (!state.settings.notificationsEnabled || !("Notification" in window) || Notification.permission !== "granted") {
      return undefined;
    }

    const timers = state.habits
      .filter((habit) => habit.reminderTime && !habit.completions?.[today])
      .map((habit) => {
        const delay = delayUntilNextReminder(habit.reminderTime);
        return window.setTimeout(() => {
          if (habit.completions?.[today]) return;
          showHabitNotification(habit.name);
        }, delay);
      });

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [state]);
}

function delayUntilNextReminder(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const reminder = new Date();
  reminder.setHours(hours || 0, minutes || 0, 0, 0);
  if (reminder <= new Date()) reminder.setDate(reminder.getDate() + 1);
  return reminder.getTime() - Date.now();
}

function showHabitNotification(habitName) {
  const title = "JourneyFit habit reminder";
  const options = {
    body: `Time to check off: ${habitName}`,
    tag: `journeyfit-${habitName}`,
    badge: "/icon.svg",
    icon: "/icon.svg"
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.showNotification(title, options))
      .catch(() => new Notification(title, options));
    return;
  }

  new Notification(title, options);
}

function notificationStatusText(permission, enabled) {
  if (permission === "unsupported") return "This browser does not support web notifications.";
  if (permission === "denied") return "Notifications are blocked in browser settings.";
  if (enabled && permission === "granted") return "Reminders are active for habits with a time set.";
  return "Enable notifications, then choose a reminder time for each habit.";
}

function exportData(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `journeyfit-${today}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event, setState) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      setState(mergeState(JSON.parse(reader.result)));
    } catch {
      alert("That file is not a valid JourneyFit export.");
    }
  });
  reader.readAsText(file);
}

function removeById(collection, entryId) {
  const index = collection.findIndex((entry) => entry.id === entryId);
  if (index >= 0) collection.splice(index, 1);
}

function mergeState(savedState = {}) {
  return {
    ...starterState,
    ...savedState,
    settings: {
      ...starterState.settings,
      ...(savedState.settings || {})
    }
  };
}

function groupWorkoutTypes(workouts) {
  return Object.values(workouts.reduce((groups, workout) => {
    groups[workout.type] ||= { type: workout.type, minutes: 0 };
    groups[workout.type].minutes += Number(workout.duration) || 0;
    return groups;
  }, {})).sort((a, b) => b.minutes - a.minutes);
}

function sumWorkoutCalories(workouts, weightInPounds) {
  const weightKg = toDisplayWeight(weightInPounds, "kg");
  return workouts.reduce((total, workout) => {
    const typeMets = metTable[workout.type] || metTable.Other;
    const met = typeMets[workout.intensity] || typeMets.Moderate;
    const hours = (Number(workout.duration) || 0) / 60;
    return total + met * weightKg * hours;
  }, 0);
}

function roundMacro(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function mapLatestByDate(entries, key) {
  return entries.reduce((dates, entry) => {
    dates[entry.date] = Number(entry[key]);
    return dates;
  }, {});
}

function sortByDate(entries) {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

function sum(entries, key) {
  return entries.reduce((total, entry) => total + (Number(entry[key]) || 0), 0);
}

function shiftDate(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateKey) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${dateKey}T12:00:00`));
}

function formatLongDate(dateKey) {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${dateKey}T12:00:00`));
}

function shortDay(dateKey) {
  return new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric" }).format(new Date(`${dateKey}T12:00:00`));
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toDisplayWeight(weightInPounds, unit) {
  const value = Number(weightInPounds) || 0;
  return unit === "kg" ? value / 2.2046226218 : value;
}

function toStoredWeight(displayWeight, unit) {
  const value = Number(displayWeight) || 0;
  return unit === "kg" ? value * 2.2046226218 : value;
}

function formatWeight(weightInPounds, unit = "lb") {
  return `${toDisplayWeight(weightInPounds, unit).toFixed(1)} ${unit}`;
}

function formatTooltipValue(item, unit) {
  if (item.value == null) return "-";
  if (item.dataKey === "weight" && unit) return `${Number(item.value).toFixed(1)} ${unit}`;
  if (item.dataKey === "progress") return `${Number(item.value).toFixed(1)}%`;
  if (item.dataKey === "calories") return `${Number(item.value).toLocaleString()} kcal`;
  return item.value;
}

function calculateProgress(startWeight, currentWeight, goalWeight) {
  const start = Number(startWeight);
  const current = Number(currentWeight);
  const goal = Number(goalWeight);
  if (!start || !current || !goal || start === goal) return null;
  const progress = ((start - current) / (start - goal)) * 100;
  return Math.max(0, Math.min(100, Math.round(progress * 10) / 10));
}

function id() {
  return window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

createRoot(document.getElementById("root")).render(<App />);
