-- Survival HUD — Vehicle Extension
-- Collects physics, G-forces, beam damage, body-damage zones.
-- Sends JSON to the GE extension every UPDATE_INTERVAL seconds.

local M = {}
local logTag = 'survivalhud'

local UPDATE_INTERVAL = 0.05   -- 20 Hz

local timer          = 0
local prevBeamBroken = 0
local damageAccum    = 0       -- 0-100, structural damage score
local impactGPeak    = 0       -- peak G this event, decays fast

-- Body-damage zones, 0.0 (none) … 1.0 (critical)
local bodyDamage = {
  head = 0, neck = 0, chest = 0, spine = 0, abdomen = 0,
  leftArm = 0, rightArm = 0, leftLeg = 0, rightLeg = 0,
}

local prevVelX, prevVelY, prevVelZ = 0, 0, 0

-- ─── helpers ────────────────────────────────────────────────────────────────

local function clamp(v, lo, hi)
  return v < lo and lo or (v > hi and hi or v)
end

local function len3(x, y, z)
  return math.sqrt(x * x + y * y + z * z)
end

local function bumpZone(zone, delta)
  bodyDamage[zone] = clamp(bodyDamage[zone] + delta, 0, 1)
end

-- ─── main update ────────────────────────────────────────────────────────────

local function onUpdate(dtSim)
  timer = timer + dtSim
  if timer < UPDATE_INTERVAL then return end
  local dt = timer
  timer = 0

  -- === Velocity & Speed ===
  local vel   = obj:getVelocity()
  local vx, vy, vz = vel.x, vel.y, vel.z
  local speed_kmh   = len3(vx, vy, vz) * 3.6

  -- === Angular Velocity (tumble / barrel-roll) ===
  local av  = obj:getAngularVelocity()
  local rotation = len3(av.x, av.y, av.z)   -- rad/s

  -- === Tilt: angle between vehicle-up and world-up ===
  local up   = obj:getDirectionVectorUp()
  local dotZ = clamp(up.z, -1, 1)
  local tiltDeg = math.acos(dotZ) * 180 / math.pi

  -- === Fall speed (downward component) ===
  local fallSpeed = math.max(0, -vz)

  -- === G-forces ===
  local gx = (sensors and sensors.gx) or 0
  local gy = (sensors and sensors.gy) or 0
  local gz = (sensors and sensors.gz) or 0
  local totalG   = len3(gx, gy, gz)
  local lateralG = math.abs(gy)

  -- Peak impact G, decays at 15 G/s
  if totalG > impactGPeak then impactGPeak = totalG end
  impactGPeak = math.max(0, impactGPeak - dt * 15)

  -- === Beam Damage ===
  local currentBroken = (beamstate and beamstate.beamBrokenCount) or 0
  local newBreaks     = math.max(0, currentBroken - prevBeamBroken)
  prevBeamBroken      = currentBroken

  -- Accumulate: +3 per broken beam; decay slowly
  damageAccum = clamp(damageAccum + newBreaks * 3 - dt * 0.8, 0, 100)

  -- === Body-damage update (only when impact G > 4 and new breaks exist) ===
  if totalG > 4 and newBreaks > 0 then
    local mag  = clamp((totalG - 4) / 25, 0, 1)
    local fwd  = obj:getDirectionVector()

    -- Longitudinal delta-v (forward/backward)
    local dvX = vx - prevVelX
    local dvY = vy - prevVelY
    local dvZ = vz - prevVelZ
    local longitudinal = dvX * fwd.x + dvY * fwd.y + dvZ * fwd.z

    -- Frontal impact
    if longitudinal < -3 then
      local m = mag * clamp(-longitudinal / 15, 0, 1)
      bumpZone('head',    m * 0.35)
      bumpZone('neck',    m * 0.30)
      bumpZone('chest',   m * 0.50)
      bumpZone('abdomen', m * 0.25)
    end

    -- Rear impact
    if longitudinal > 3 then
      local m = mag * clamp(longitudinal / 15, 0, 1)
      bumpZone('neck',    m * 0.35)
      bumpZone('spine',   m * 0.50)
      bumpZone('abdomen', m * 0.30)
    end

    -- Side impact
    if math.abs(gy) > 5 then
      local m = mag * clamp((math.abs(gy) - 5) / 15, 0, 1)
      if gy > 0 then
        bumpZone('rightArm', m * 0.55)
      else
        bumpZone('leftArm',  m * 0.55)
      end
      bumpZone('chest', m * 0.30)
    end

    -- Vertical / landing
    if dvZ < -3 then
      local m = mag * clamp(-dvZ / 10, 0, 1)
      bumpZone('leftLeg',  m * 0.45)
      bumpZone('rightLeg', m * 0.45)
      bumpZone('spine',    m * 0.40)
    end

    -- Rollover bonus damage (head/neck)
    if rotation > 2 then
      bumpZone('head', mag * 0.20)
      bumpZone('neck', mag * 0.20)
    end
  end

  -- Slow passive heal
  local heal = dt * 0.003
  for k in pairs(bodyDamage) do
    bodyDamage[k] = math.max(0, bodyDamage[k] - heal)
  end

  prevVelX, prevVelY, prevVelZ = vx, vy, vz

  -- === Send to GE extension ===
  local payload = json.encode({
    speed     = speed_kmh,
    rotation  = rotation,
    tilt      = tiltDeg,
    fallSpeed = fallSpeed,
    lateralG  = lateralG,
    impactG   = impactGPeak,
    damage    = damageAccum,
    bodyDamage = bodyDamage,
  })
  obj:queueGameEngineLua(
    string.format('if survivalhud_ge then survivalhud_ge.onVehicleData(%q) end', payload)
  )
end

-- ─── extension hooks ────────────────────────────────────────────────────────

local function onExtensionLoaded()
  log('I', logTag, 'Survival HUD vehicle extension loaded')
end

local function onReset()
  -- Reset state on scenario reset but keep damage for continuity
  timer          = 0
  impactGPeak    = 0
  prevVelX, prevVelY, prevVelZ = 0, 0, 0
end

M.onUpdate          = onUpdate
M.onExtensionLoaded = onExtensionLoaded
M.onReset           = onReset

return M
