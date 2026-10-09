(() => {
  "use strict";
  const STORAGE_KEY = "gymquest.web.v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const dayBefore = key => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const builtIns = [
    ["Barbell Bench Press","Chest","Barbell",4,"6–8"],["Incline Dumbbell Press","Chest","Dumbbells",3,"8–12"],["Chest Press Machine","Chest","Machine",3,"8–12"],["Cable Fly","Chest","Cable",3,"12–15"],["Push-Ups","Chest","Bodyweight",3,"AMRAP"],
    ["Lat Pulldown","Back","Cable machine",3,"8–12"],["Seated Cable Row","Back","Cable machine",3,"8–12"],["Chest-Supported Row","Back","Machine or bench",3,"8–12"],["Assisted Pull-Up","Back","Pull-up machine",3,"6–10"],["Face Pull","Back","Cable",3,"12–15"],
    ["Overhead Press","Shoulders","Barbell or dumbbells",3,"6–10"],["Dumbbell Lateral Raise","Shoulders","Dumbbells",3,"12–15"],["Reverse Pec Deck","Shoulders","Machine",3,"12–15"],["Rear Delt Fly","Shoulders","Dumbbells or machine",3,"12–15"],
    ["Squat","Legs","Barbell or bodyweight",4,"6–10"],["Leg Press","Legs","Machine",3,"10–12"],["Romanian Deadlift","Legs","Barbell or dumbbells",3,"8–10"],["Leg Curl","Legs","Machine",3,"10–15"],["Leg Extension","Legs","Machine",3,"10–15"],["Standing Calf Raise","Legs","Machine",3,"12–20"],
    ["Dumbbell Bicep Curl","Arms","Dumbbells",3,"10–12"],["Hammer Curl","Arms","Dumbbells",3,"10–12"],["Cable Triceps Pushdown","Arms","Cable",3,"10–15"],["Overhead Triceps Extension","Arms","Cable or dumbbell",3,"10–15"],
    ["Plank","Core","Bodyweight",3,"30–60 sec"],["Dead Bug","Core","Bodyweight",3,"10 each side"],["Cable Crunch","Core","Cable",3,"12–15"],["Hanging Knee Raise","Core","Pull-up bar",3,"8–12"],
    ["Treadmill Walk","Cardio","Treadmill",1,"10 min"],["Stationary Bike","Cardio","Bike",1,"10 min"],["Rowing Machine","Cardio","Rower",1,"5–10 min"],
    ["Goblet Squat","Full Body","Dumbbell or kettlebell",3,"10–12"],["Farmer's Carry","Full Body","Dumbbells",3,"30–45 sec"],["Burpees","Full Body","Bodyweight",3,"8–12"]
  ].map(([name,muscle,equipment,sets,reps]) => ({id:`builtin-${name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,name,muscle,equipment,sets,reps,builtin:true}));
  const ACHIEVEMENTS = [
    {id:"first-workout",icon:"🎯",name:"First Quest",description:"Complete your first workout.",test:s=>s.history.length>=1,xp:25},
    {id:"five-workouts",icon:"🖐️",name:"Getting Consistent",description:"Complete 5 workouts.",test:s=>s.history.length>=5,xp:50},
    {id:"ten-workouts",icon:"🏅",name:"Dedicated",description:"Complete 10 workouts.",test:s=>s.history.length>=10,xp:75},
    {id:"twenty-five",icon:"🏆",name:"Iron Habit",description:"Complete 25 workouts.",test:s=>s.history.length>=25,xp:150},
    {id:"first-streak",icon:"🔥",name:"On a Roll",description:"Build a 3-day workout streak.",test:s=>s.bestStreak>=3,xp:50},
    {id:"week-streak",icon:"⚡",name:"Unstoppable",description:"Build a 7-day workout streak.",test:s=>s.bestStreak>=7,xp:150},
    {id:"library-five",icon:"📚",name:"Exercise Collector",description:"Add 5 custom exercises.",test:s=>s.exercises.filter(e=>!e.builtin).length>=5,xp:30},
    {id:"workout-builder",icon:"🧩",name:"Quest Creator",description:"Create your first workout routine.",test:s=>s.workouts.length>=1,xp:20},
    {id:"level-five",icon:"🌟",name:"Rising Hero",description:"Reach level 5.",test:s=>levelInfo(s.xp).level>=5,xp:100}
  ];
  function freshState() {
    return {version:1,xp:0,exercises:[...builtIns],workouts:[],history:[],earned:[],lastWorkoutDate:null,currentStreak:0,bestStreak:0,customIds:[],session:null};
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshState();
      const parsed = JSON.parse(raw);
      const defaults = freshState();
      const exercises = Array.isArray(parsed.exercises) ? parsed.exercises : defaults.exercises;
      const custom = exercises.filter(e=>!e.builtin);
      const byId = new Map([...defaults.exercises,...custom].map(e=>[e.id,e]));
      return {...defaults,...parsed,exercises:[...defaults.exercises,...custom],workouts:Array.isArray(parsed.workouts)?parsed.workouts:[],history:Array.isArray(parsed.history)?parsed.history:[],earned:Array.isArray(parsed.earned)?parsed.earned:[],customIds:parsed.customIds||custom.map(e=>e.id)};
    } catch { return freshState(); }
  }
  let state = loadState();
  let editingWorkoutId = null;
  let activeSession = null;
  let earnedThisSession = 0;
  let toastTimer;
  function save() { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); } catch { toast("Couldn't save locally. Check your browser storage."); } }
  function esc(value) { return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function levelInfo(xp) {
    let level=1, remaining=Math.max(0,xp), need=250;
    while (remaining>=need && level<1000) { remaining-=need; level++; need=Math.round(250+(level-1)*100); }
    const nextNeed=Math.round(250+(level-1)*100);
    return {level,within:remaining,need:nextNeed,rank:level<3?"Gym Recruit":level<5?"Rookie Lifter":level<8?"Iron Apprentice":level<12?"Strength Seeker":level<20?"Elite Athlete":"Legendary Warrior"};
  }
  function calcStreak(history) {
    const days=[...new Set(history.map(h=>h.date))].sort().reverse();
    if (!days.length) return {current:0,best:0};
    const today=todayKey(), yesterday=dayBefore(today);
    let current=0;
    if(days[0]===today||days[0]===yesterday) {
      let expected=days[0];
      for(const d of days){if(d!==expected)break;current++;expected=dayBefore(expected);}
    }
    let best=0,run=0,prev=null;
    for(const d of [...days].reverse()){if(prev&&d===nextDay(prev))run++;else run=1;best=Math.max(best,run);prev=d;}
    return {current,best:Math.max(best,current)};
  }
  function nextDay(key){const d=new Date(`${key}T12:00:00`);d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
  function toast(message){const node=$("#toast");node.textContent=message;node.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove("show"),2300);}
  function getExercise(id){return state.exercises.find(e=>e.id===id);}
  function checkAchievements() {
    const newly=[];
    for(const a of ACHIEVEMENTS){if(!state.earned.includes(a.id)&&a.test(state)){state.earned.push(a.id);state.xp+=a.xp;newly.push(a);}}
    return newly;
  }
  function setPage(page) {
    $$(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${page}`));
    $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
    $("#bottomNav").style.display=page==="session"?"none":"grid";
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function workoutCard(w) {
    const exercises=w.exerciseIds.map(getExercise).filter(Boolean);
    return `<article class="workout-card"><div class="workout-symbol">🏋️</div><div class="workout-card-main"><h3>${esc(w.name)}</h3><p>${exercises.length} exercises · ${exercises.reduce((sum,e)=>sum+e.sets,0)} total sets</p></div><div class="card-actions"><button class="small-button start" data-start="${esc(w.id)}">Start ▶</button><button class="small-button" data-edit="${esc(w.id)}">Edit</button><button class="small-button" data-delete="${esc(w.id)}" aria-label="Delete ${esc(w.name)}">✕</button></div></article>`;
  }
  function empty(title,description){return `<div class="empty-state"><strong>${esc(title)}</strong>${esc(description)}</div>`;}
  function renderDashboard(){
    const info=levelInfo(state.xp);
    $("#levelNumber").textContent=info.level;$("#rankName").textContent=info.rank;$("#totalXp").textContent=state.xp.toLocaleString();
    $("#xpText").textContent=`${info.within} / ${info.need} XP to next level`;$("#xpBar").style.width=`${Math.min(100,info.within/info.need*100)}%`;
    const streak=calcStreak(state.history);state.currentStreak=streak.current;state.bestStreak=Math.max(state.bestStreak||0,streak.best);
    $("#streakValue").textContent=streak.current;$("#workoutCount").textContent=state.history.length;$("#achievementCount").textContent=state.earned.length;
    $("#dashboardWorkouts").innerHTML=state.workouts.length?state.workouts.slice(0,3).map(workoutCard).join(""):empty("Your first quest starts here","Create a workout from your exercise library to begin.");
    $("#dashboardAchievements").innerHTML=ACHIEVEMENTS.filter(a=>state.earned.includes(a.id)).slice(-5).map(a=>`<div class="achievement-chip"><div class="badge-icon">${a.icon}</div><strong>${esc(a.name)}</strong><span>+${a.xp} XP earned</span></div>`).join("")||empty("No achievements yet","Complete workouts to unlock your first badge.");
  }
  function renderWorkouts(){ $("#workoutList").innerHTML=state.workouts.length?state.workouts.map(workoutCard).join(""):empty("No workouts yet","Create your first routine and pick the exercises you want to do."); }
  function renderLibrary(){
    const q=$("#exerciseSearch").value.trim().toLowerCase(), muscle=$("#muscleFilter").value;
    const list=state.exercises.filter(e=>(muscle==="All"||e.muscle===muscle)&&`${e.name} ${e.muscle} ${e.equipment}`.toLowerCase().includes(q));
    $("#libraryCount").textContent=`${list.length} exercise${list.length===1?"":"s"} · ${state.exercises.filter(e=>!e.builtin).length} custom`;
    $("#exerciseList").innerHTML=list.map(e=>`<div class="exercise-row"><div class="exercise-emoji">${muscleIcon(e.muscle)}</div><div class="exercise-info"><strong>${esc(e.name)}</strong><span>${esc(e.muscle)} · ${esc(e.equipment||"Equipment not set")} · ${e.sets} × ${esc(e.reps)}</span></div>${e.builtin?`<span class="muted tiny">BUILT-IN</span>`:`<button class="small-button" data-remove-exercise="${esc(e.id)}">Remove</button>`}</div>`).join("")||empty("No matches","Try another search or muscle group.");
  }
  function muscleIcon(m){return ({Chest:"💥",Back:"🪽",Shoulders:"🛡️",Legs:"🦵",Arms:"💪",Core:"🎯",Cardio:"🏃","Full Body":"⚡"})[m]||"🏋️";}
  function renderProgress(){
    const streak=calcStreak(state.history);
    $("#progressXp").textContent=state.xp.toLocaleString();$("#progressStreak").textContent=`${streak.current} days`;$("#progressWorkouts").textContent=state.history.length;
    $("#allAchievements").innerHTML=ACHIEVEMENTS.map(a=>{const earned=state.earned.includes(a.id);return `<div class="achievement-row ${earned?"":"locked"}"><div class="badge-icon">${a.icon}</div><div><strong>${esc(a.name)}</strong><p>${esc(a.description)}</p></div><span class="earned-label">${earned?"UNLOCKED":`+${a.xp} XP`}</span></div>`;}).join("");
    $("#historyList").innerHTML=state.history.length?[...state.history].reverse().slice(0,30).map(h=>`<div class="history-item"><div><strong>${esc(h.name)}</strong><span>${esc(h.date)} · ${h.exerciseCount} exercises · ${Math.max(1,Math.round((h.duration||0)/60))} min</span></div><span class="history-xp">+${h.xp} XP</span></div>`).join(""):empty("No history yet","Your completed workouts will appear here.");
  }
  function renderAll(){renderDashboard();renderWorkouts();renderLibrary();renderProgress();save();}
  function openWorkoutDialog(id=null){
    editingWorkoutId=id;const workout=id?state.workouts.find(w=>w.id===id):null;
    $("#workoutDialogTitle").textContent=workout?"Edit workout":"Create workout";$("#workoutName").value=workout?.name||"";
    $("#workoutExerciseSearch").value="";renderWorkoutChoices(workout?.exerciseIds||[]);
    $("#workoutDialog").showModal();
  }
  function renderWorkoutChoices(selected=[]){
    const q=$("#workoutExerciseSearch").value.trim().toLowerCase();
    const filtered=state.exercises.filter(e=>`${e.name} ${e.muscle}`.toLowerCase().includes(q));
    $("#workoutExerciseChoices").innerHTML=filtered.map(e=>`<label class="choice-row"><input type="checkbox" name="workoutExercise" value="${esc(e.id)}" ${selected.includes(e.id)?"checked":""}><span>${esc(e.name)}<small>${esc(e.muscle)} · ${e.sets} × ${esc(e.reps)}</small></span></label>`).join("")||empty("No exercises found","Add an exercise to your library first.");
  }
  function saveWorkout(event){
    event.preventDefault();const name=$("#workoutName").value.trim(), ids=$$('input[name="workoutExercise"]:checked').map(i=>i.value).filter(id=>getExercise(id));
    if(!name){toast("Give your workout a name.");return;}if(!ids.length){toast("Choose at least one exercise.");return;}
    if(editingWorkoutId){const w=state.workouts.find(w=>w.id===editingWorkoutId);if(w){w.name=name;w.exerciseIds=ids;}}
    else state.workouts.push({id:uid(),name,exerciseIds:ids,createdAt:Date.now()});
    const newAchievements=checkAchievements();save();$("#workoutDialog").close();renderAll();toast(newAchievements.length?`Achievement unlocked: ${newAchievements[0].name}!`:"Workout saved.");
  }
  function addCustomExercise(event){
    event.preventDefault();const name=$("#customExerciseName").value.trim();if(!name){toast("Enter an exercise name.");return;}
    if(state.exercises.some(e=>e.name.toLowerCase()===name.toLowerCase())){toast("That exercise is already in your library.");return;}
    const sets=Math.max(1,Math.min(10,Number($("#customExerciseSets").value)||3));
    const ex={id:uid(),name,muscle:$("#customExerciseMuscle").value,equipment:$("#customExerciseEquipment").value.trim()||"Not specified",sets,reps:$("#customExerciseReps").value.trim()||"8–12",builtin:false};
    state.exercises.push(ex);state.customIds.push(ex.id);const newly=checkAchievements();save();$("#exerciseDialog").close();$("#exerciseForm").reset();$("#customExerciseSets").value=3;$("#customExerciseReps").value="8–12";renderAll();toast(newly.length?`Achievement unlocked: ${newly[0].name}!`:"Custom exercise added.");
  }
  function startWorkout(id){
    const w=state.workouts.find(w=>w.id===id);if(!w)return;
    const exs=w.exerciseIds.map(getExercise).filter(Boolean);if(!exs.length){toast("Add exercises to this workout first.");return;}
    activeSession={workoutId:w.id,name:w.name,startedAt:Date.now(),items:exs.map(e=>({exerciseId:e.id,done:false,sets:e.sets,reps:e.reps,weight:""}))};earnedThisSession=0;
    $("#sessionName").textContent=w.name;$("#sessionMeta").textContent=`${exs.length} exercises · You've got this.`;renderSession();setPage("session");
  }
  function renderSession(){
    if(!activeSession)return;const done=activeSession.items.filter(i=>i.done).length,total=activeSession.items.length,pct=total?Math.round(done/total*100):0;
    $("#sessionProgressText").textContent=`${done} of ${total} complete`;$("#sessionPercent").textContent=`${pct}%`;$("#sessionProgressBar").style.width=`${pct}%`;
    $("#sessionExercises").innerHTML=activeSession.items.map((item,index)=>{const ex=getExercise(item.exerciseId);if(!ex)return"";return `<article class="session-exercise ${item.done?"completed":""}"><div class="session-exercise-top"><button class="check-button" data-toggle-exercise="${index}" aria-label="${item.done?"Mark incomplete":"Complete"} ${esc(ex.name)}">${item.done?"✓":"✓"}</button><div class="session-exercise-name"><strong>${index+1}. ${esc(ex.name)}</strong><span>${esc(ex.muscle)} · ${esc(ex.equipment||"")}</span></div><span class="muted tiny">${item.done?"DONE":`${index+1}/${total}`}</span></div><div class="session-fields"><label>Sets<input type="number" min="1" max="20" data-field="sets" data-index="${index}" value="${esc(item.sets)}"></label><label>Reps / time<input data-field="reps" data-index="${index}" value="${esc(item.reps)}" maxlength="20"></label><label>Weight<input data-field="weight" data-index="${index}" value="${esc(item.weight)}" placeholder="kg" maxlength="15"></label></div><button class="small-button rest-button" data-rest="${index}">⏱ Rest 90 sec</button></article>`;}).join("");
    $("#finishWorkout").disabled=done===0;
    $("#finishWorkout").textContent=done===total?`Finish workout · +50 XP`:`Finish session · +50 XP`;
  }
  function toggleSessionExercise(index){
    const item=activeSession?.items[index];if(!item)return;
    item.done=!item.done;
    if(item.done){state.xp+=10;earnedThisSession+=10;toast("+10 XP — exercise complete!");}
    else{state.xp=Math.max(0,state.xp-10);earnedThisSession=Math.max(0,earnedThisSession-10);}
    save();renderSession();renderDashboard();
  }
  let restInterval=null;
  function startRest(button){if(restInterval)clearInterval(restInterval);let remaining=90;button.textContent=`⏱ ${remaining}s rest`;restInterval=setInterval(()=>{remaining--;if(!button.isConnected){clearInterval(restInterval);restInterval=null;return;}if(remaining<=0){clearInterval(restInterval);restInterval=null;button.textContent="✓ Rest complete";if(navigator.vibrate)navigator.vibrate(150);}else button.textContent=`⏱ ${remaining}s rest`;},1000);}
  function finishWorkout(){
    if(!activeSession)return;const done=activeSession.items.filter(i=>i.done).length;if(!done){toast("Complete at least one exercise first.");return;}
    const before=state.xp,bonus=50;state.xp+=bonus;
    const duration=Math.max(1,Math.round((Date.now()-activeSession.startedAt)/1000));
    const record={id:uid(),workoutId:activeSession.workoutId,name:activeSession.name,date:todayKey(),completedAt:Date.now(),exerciseCount:done,totalExercises:activeSession.items.length,duration,xp:earnedThisSession+bonus,items:activeSession.items.filter(i=>i.done).map(i=>({exerciseId:i.exerciseId,sets:i.sets,reps:i.reps,weight:i.weight}))};
    state.history.push(record);const streak=calcStreak(state.history);state.currentStreak=streak.current;state.bestStreak=Math.max(state.bestStreak||0,streak.best);
    const newAchievements=checkAchievements();const after=levelInfo(state.xp),prior=levelInfo(before);
    const earned=earnedThisSession+bonus+newAchievements.reduce((sum,a)=>sum+a.xp,0);
    save();activeSession=null;if(restInterval){clearInterval(restInterval);restInterval=null;}
    $("#completeTitle").textContent=after.level>prior.level?`Level ${after.level} unlocked!`:"Workout complete!";
    $("#completeMessage").textContent=newAchievements.length?`Achievement unlocked: ${newAchievements.map(a=>a.name).join(", ")}.`:"You showed up for yourself. Come back when you're ready for your next quest.";
    $("#earnedXp").textContent=`+${earned} XP`;$("#completeDialog").showModal();renderAll();
  }
  function closeSession(){if(!activeSession)return;if(confirm("Exit this workout? Your current session checklist won't be saved.")){activeSession=null;if(restInterval){clearInterval(restInterval);restInterval=null;}setPage("dashboard");}}
  function deleteWorkout(id){const w=state.workouts.find(w=>w.id===id);if(!w)return;if(confirm(`Delete "${w.name}"?`)){state.workouts=state.workouts.filter(w=>w.id!==id);save();renderAll();toast("Workout deleted.");}}
  function removeExercise(id){const ex=getExercise(id);if(!ex||ex.builtin)return;if(state.workouts.some(w=>w.exerciseIds.includes(id))&&!confirm("This exercise is used in one or more workouts. Remove it anyway?"))return;state.exercises=state.exercises.filter(e=>e.id!==id);state.customIds=state.customIds.filter(x=>x!==id);state.workouts.forEach(w=>w.exerciseIds=w.exerciseIds.filter(x=>x!==id));save();renderAll();toast("Exercise removed.");}
  document.addEventListener("click",e=>{
    const page=e.target.closest("[data-page]");if(page){e.preventDefault();setPage(page.dataset.page);}
    const close=e.target.closest("[data-close]");if(close)$("#"+close.dataset.close).close();
    const start=e.target.closest("[data-start]");if(start)startWorkout(start.dataset.start);
    const edit=e.target.closest("[data-edit]");if(edit)openWorkoutDialog(edit.dataset.edit);
    const del=e.target.closest("[data-delete]");if(del)deleteWorkout(del.dataset.delete);
    const rem=e.target.closest("[data-remove-exercise]");if(rem)removeExercise(rem.dataset.removeExercise);
    const toggle=e.target.closest("[data-toggle-exercise]");if(toggle)toggleSessionExercise(Number(toggle.dataset.toggleExercise));
    const rest=e.target.closest("[data-rest]");if(rest)startRest(rest);
  });
  $("#newWorkoutButton").addEventListener("click",()=>openWorkoutDialog());
  $("#addExerciseButton").addEventListener("click",()=>$("#exerciseDialog").showModal());
  $("#workoutForm").addEventListener("submit",saveWorkout);
  $("#exerciseForm").addEventListener("submit",addCustomExercise);
  $("#workoutExerciseSearch").addEventListener("input",()=>{const selected=$$('input[name="workoutExercise"]:checked').map(i=>i.value);renderWorkoutChoices(selected);});
  $("#exerciseSearch").addEventListener("input",renderLibrary);$("#muscleFilter").addEventListener("change",renderLibrary);
  $("#quickStart").addEventListener("click",()=>{if(state.workouts.length)startWorkout(state.workouts[0].id);else openWorkoutDialog();});
  $("#leaveSession").addEventListener("click",closeSession);$("#finishWorkout").addEventListener("click",finishWorkout);
  $("#closeComplete").addEventListener("click",()=>{$("#completeDialog").close();setPage("dashboard");});
  $("#resetProgress").addEventListener("click",()=>{if(confirm("This permanently deletes your workouts, custom exercises, XP, streaks and history from this browser. Continue?")){localStorage.removeItem(STORAGE_KEY);state=freshState();activeSession=null;renderAll();setPage("dashboard");toast("All GymQuest data reset.");}});
  $("#profileButton").addEventListener("click",()=>toast("Your progress is saved on this device. Keep training!"));
  window.addEventListener("beforeunload",()=>{if(activeSession)save();});
  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"))window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
  renderAll();
})();