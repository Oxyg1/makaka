-- Survival HUD — GE Extension
-- Receives vehicle physics data, adds environment/traffic context,
-- calculates survival chance (10 factors), pushes to UI.

local M = {}
local logTag = 'survivalhud_ge'

local ENV_INTERVAL = 0.5   -- re-check weather/time/traffic every 500 ms
local envTimer     = 0

-- Latest vehicle data (filled by onVehicleData)
local vdata = {
  speed     = 0,
  rotation  = 0,
  tilt      = 0,
  fallSpeed = 0,
  lateralG  = 0,
  impactG   = 0,
  damage    = 0,
  bodyDamage = {
    head=0, neck=0, chest=0, spine=0, abdomen=0,
    leftArm=0, rightArm=0, leftLeg=0, rightLeg=0,
  },
}

-- Latest environment data
local edata = {
  trafficRisk  = 0,
  trafficDist  = 999,
  timeRisk     = 0,
  weatherRisk  = 0,
  weatherLabel = 'Ясно',
  timeLabel    = 'День',
}

-- ─── helpers ────────────────────────────────────────────────────────────────

local function clamp(v, lo, hi)
  return v < lo and lo or (v > hi and hi or v)
end

-- ─── environment sampling ────────────────────────────────────────────────────

local function sampleEnvironment()
  -- Time of day
  local timeRisk  = 0
  local timeLabel = 'День'
  if core_environment then
    local env = core_environment.getState and core_environment.getState() or {}
    local tod = env.timeOfDay or 0.5   -- 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk
    if tod < 0.20 or tod > 0.83 then
      timeRisk  = 3
      timeLabel = 'Ночь'
    elseif tod < 0.28 or tod > 0.75 then
      timeRisk  = 2
      timeLabel = 'Сумерки'
    else
      timeRisk  = 0
      timeLabel = 'День'
    end

    -- Precipitation
    local precip = env.precipitationAmount or 0
    local weatherRisk, weatherLabel
    if precip > 0.70 then
      weatherRisk  = 5
      weatherLabel = 'Ливень'
    elseif precip > 0.35 then
      weatherRisk  = 3
      weatherLabel = 'Дождь'
    elseif precip > 0.05 then
      weatherRisk  = 2
      weatherLabel = 'Морось'
    else
      weatherRisk  = 0
      weatherLabel = 'Ясно'
    end
    edata.weatherRisk  = weatherRisk
    edata.weatherLabel = weatherLabel
  end
  edata.timeRisk  = timeRisk
  edata.timeLabel = timeLabel

  -- Nearest other vehicle
  local playerVeh = be:getPlayerVehicle(0)
  if playerVeh then
    local pPos   = playerVeh:getPosition()
    local pVel   = playerVeh:getVelocity()
    local pSpeed = pVel and pVel:length() or 0
    local minDist = 999
    local count   = be:getObjectCount()
    for i = 0, count - 1 do
      local obj2 = be:getObject(i)
      if obj2 and obj2:getID() ~= playerVeh:getID() then
        local cls = obj2:getClassName and obj2:getClassName() or ''
        if cls == 'BeamNGVehicle' then
          local dist = (pPos - obj2:getPosition()):length()
          if dist < minDist then minDist = dist end
        end
      end
    end
    edata.trafficDist = minDist
    -- Risk grows when close AND moving fast
    if minDist < 100 then
      local proximity = clamp((100 - minDist) / 100, 0, 1)
      local speedFactor = clamp(pSpeed / 30, 0, 1)
      edata.trafficRisk = clamp(proximity * speedFactor * 8, 0, 8)
    else
      edata.trafficRisk = 0
    end
  end
end

-- ─── survival-chance calculation ─────────────────────────────────────────────

local function calcSurvival()
  local d = vdata
  local e = edata

  -- Raw risk values normalised to [0..1]
  local rSpeed    = clamp(d.speed    / 200,         0, 1)
  local rDamage   = clamp(d.damage   / 100,         0, 1)
  local rRotation = clamp((d.rotation - 0.5) / 4,   0, 1)
  local rTilt     = clamp((d.tilt - 20)      / 160,  0, 1)
  local rImpact   = clamp((d.impactG - 3)    / 30,   0, 1)
  local rLateral  = clamp((d.lateralG - 1)   / 6,    0, 1)
  local rFall     = clamp((d.fallSpeed - 2)  / 20,   0, 1)
  local rTraffic  = clamp(e.trafficRisk      / 8,    0, 1)
  local rTime     = clamp(e.timeRisk         / 3,    0, 1)
  local rWeather  = clamp(e.weatherRisk      / 5,    0, 1)

  -- Weighted penalty (sum → percentage points off 100)
  local penalty =
    rSpeed    * 15 +
    rDamage   * 25 +
    rRotation * 12 +
    rTilt     * 10 +
    rImpact   * 25 +
    rLateral  *  8 +
    rFall     * 12 +
    rTraffic  *  8 +
    rTime     *  3 +
    rWeather  *  5

  local chance = clamp(100 - penalty, 0, 100)

  return chance, {
    speed    = rSpeed    * 15,
    damage   = rDamage   * 25,
    rotation = rRotation * 12,
    tilt     = rTilt     * 10,
    impact   = rImpact   * 25,
    lateral  = rLateral  *  8,
    fall     = rFall     * 12,
    traffic  = rTraffic  *  8,
    time     = rTime     *  3,
    weather  = rWeather  *  5,
  }
end

-- ─── public: called from vehicle extension ───────────────────────────────────

function M.onVehicleData(jsonStr)
  local ok, decoded = pcall(json.decode, jsonStr)
  if not ok or type(decoded) ~= 'table' then return end
  for k, v in pairs(decoded) do
    vdata[k] = v
  end

  local chance, risks = calcSurvival()

  guihooks.trigger('survivalhudData', {
    survivalChance = chance,
    speed          = vdata.speed,
    rotation       = vdata.rotation,
    tilt           = vdata.tilt,
    fallSpeed      = vdata.fallSpeed,
    lateralG       = vdata.lateralG,
    impactG        = vdata.impactG,
    damage         = vdata.damage,
    trafficDist    = edata.trafficDist,
    weatherLabel   = edata.weatherLabel,
    timeLabel      = edata.timeLabel,
    risks          = risks,
    bodyDamage     = vdata.bodyDamage,
  })
end

-- ─── GE update loop (env sampling) ──────────────────────────────────────────

local function onUpdate(dt)
  envTimer = envTimer + dt
  if envTimer >= ENV_INTERVAL then
    envTimer = 0
    sampleEnvironment()
  end
end

-- ─── vehicle spawn: inject vehicle extension ────────────────────────────────

local function onVehicleSpawned(gameVehicleID)
  local v = be:getObjectByID(gameVehicleID)
  if v and v:getPlayerID() == 0 then
    -- slight delay so vehicle Lua is ready
    v:queueLuaCommand('extensions.load("survivalhud")')
    log('I', logTag, 'Injected survivalhud vehicle extension into vehicle ' .. tostring(gameVehicleID))
  end
end

local function onExtensionLoaded()
  log('I', logTag, 'Survival HUD GE extension loaded')
  -- Inject into already-spawned player vehicle if present
  local pv = be:getPlayerVehicle(0)
  if pv then
    pv:queueLuaCommand('extensions.load("survivalhud")')
  end
end

local function onExtensionUnloaded()
  -- Unload vehicle extension cleanly
  local pv = be:getPlayerVehicle(0)
  if pv then
    pv:queueLuaCommand('extensions.unload("survivalhud")')
  end
end

M.onUpdate             = onUpdate
M.onVehicleSpawned     = onVehicleSpawned
M.onExtensionLoaded    = onExtensionLoaded
M.onExtensionUnloaded  = onExtensionUnloaded

return M
