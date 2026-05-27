'use strict';

/**
 * Survival HUD — AngularJS UI Directive
 * Listens to 'survivalhudData' from GE extension, renders two tabs.
 */
angular.module('beamng.apps').directive('survivalhud', [function () {

  // ─── Diagnosis database ────────────────────────────────────────────────────
  var DIAGNOSES = {
    head: [
      { threshold: 0.75, text: 'Черепно-мозговая травма',   severity: 'critical' },
      { threshold: 0.45, text: 'Сотрясение мозга',           severity: 'warning'  },
      { threshold: 0.15, text: 'Ушиб головы',                severity: 'mild'     },
    ],
    neck: [
      { threshold: 0.75, text: 'Перелом шейных позвонков',   severity: 'critical' },
      { threshold: 0.45, text: 'Хлыстовая травма',           severity: 'warning'  },
      { threshold: 0.15, text: 'Растяжение шеи',             severity: 'mild'     },
    ],
    chest: [
      { threshold: 0.75, text: 'Проникающая травма груди',   severity: 'critical' },
      { threshold: 0.45, text: 'Перелом рёбер',              severity: 'warning'  },
      { threshold: 0.15, text: 'Ушиб грудной клетки',        severity: 'mild'     },
    ],
    spine: [
      { threshold: 0.75, text: 'Перелом позвоночника',       severity: 'critical' },
      { threshold: 0.45, text: 'Компрессия позвоночника',    severity: 'warning'  },
      { threshold: 0.15, text: 'Растяжение спины',           severity: 'mild'     },
    ],
    abdomen: [
      { threshold: 0.75, text: 'Внутреннее кровотечение',    severity: 'critical' },
      { threshold: 0.45, text: 'Травма внутренних органов',  severity: 'warning'  },
      { threshold: 0.15, text: 'Ушиб живота',                severity: 'mild'     },
    ],
    leftArm: [
      { threshold: 0.75, text: 'Перелом левой руки',         severity: 'critical' },
      { threshold: 0.45, text: 'Вывих левого плеча',         severity: 'warning'  },
      { threshold: 0.15, text: 'Ушиб левой руки',            severity: 'mild'     },
    ],
    rightArm: [
      { threshold: 0.75, text: 'Перелом правой руки',        severity: 'critical' },
      { threshold: 0.45, text: 'Вывих правого плеча',        severity: 'warning'  },
      { threshold: 0.15, text: 'Ушиб правой руки',           severity: 'mild'     },
    ],
    leftLeg: [
      { threshold: 0.75, text: 'Перелом левой ноги',         severity: 'critical' },
      { threshold: 0.45, text: 'Разрыв связок левого колена',severity: 'warning'  },
      { threshold: 0.15, text: 'Ушиб левой ноги',            severity: 'mild'     },
    ],
    rightLeg: [
      { threshold: 0.75, text: 'Перелом правой ноги',        severity: 'critical' },
      { threshold: 0.45, text: 'Разрыв связок правого колена',severity: 'warning' },
      { threshold: 0.15, text: 'Ушиб правой ноги',           severity: 'mild'     },
    ],
  };

  var ZONE_NAMES = {
    head:     'Голова',
    neck:     'Шея',
    chest:    'Грудная клетка',
    spine:    'Позвоночник',
    abdomen:  'Живот',
    leftArm:  'Левая рука',
    rightArm: 'Правая рука',
    leftLeg:  'Левая нога',
    rightLeg: 'Правая нога',
  };

  // Factor descriptors (order = display order)
  var FACTORS = [
    { key: 'speed',    icon: '🚗', label: 'Скорость',        unit: 'км/ч', maxPts: 15 },
    { key: 'damage',   icon: '💥', label: 'Повреждения',     unit: '%',    maxPts: 25 },
    { key: 'impact',   icon: '⚡', label: 'Удар (G)',        unit: 'G',    maxPts: 25 },
    { key: 'rotation', icon: '🌀', label: 'Вращение',        unit: 'рад/с',maxPts: 12 },
    { key: 'tilt',     icon: '📐', label: 'Наклон',          unit: '°',    maxPts: 10 },
    { key: 'lateral',  icon: '↔',  label: 'Боковая нагрузка',unit: 'G',    maxPts:  8 },
    { key: 'fall',     icon: '⬇',  label: 'Падение',         unit: 'м/с',  maxPts: 12 },
    { key: 'traffic',  icon: '🚦', label: 'Трафик рядом',   unit: 'м',    maxPts:  8 },
    { key: 'time',     icon: '🌙', label: 'Время суток',     unit: '',     maxPts:  3 },
    { key: 'weather',  icon: '🌧', label: 'Осадки',          unit: '',     maxPts:  5 },
  ];

  // Gauge circumference (r=82)
  var CIRC = 2 * Math.PI * 82; // ≈ 515.2

  // ─── Colour helpers ─────────────────────────────────────────────────────────

  function survivalColor(pct) {
    if (pct >= 70) return '#00e676';   // green
    if (pct >= 45) return '#ffcc00';   // yellow
    if (pct >= 25) return '#ff6d00';   // orange
    return '#ff1744';                  // red
  }

  function riskColor(ratio) {
    // ratio = pts / maxPts  (0..1)
    if (ratio < 0.3) return '#00e676';
    if (ratio < 0.6) return '#ffcc00';
    if (ratio < 0.85) return '#ff6d00';
    return '#ff1744';
  }

  function riskLevel(ratio) {
    if (ratio < 0.3) return 'low';
    if (ratio < 0.6) return 'medium';
    if (ratio < 0.85) return 'high';
    return 'critical';
  }

  // ─── Directive definition ───────────────────────────────────────────────────

  return {
    templateUrl: '/ui/modules/survivalhud/app.html',
    replace:     true,
    restrict:    'EA',
    link: function (scope) {

      // ── Initial state ──────────────────────────────────────────────────────
      scope.activeTab      = 'chance';
      scope.showFactors    = false;
      scope.survivalChance = 100;
      scope.survivalStatus = 'БЕЗОПАСНО';
      scope.statusClass    = 'safe';
      scope.gaugeColor     = '#00e676';
      scope.gaugeDash      = CIRC;
      scope.gaugeGap       = 0;

      scope.consciousness      = 'Сознание ясное';
      scope.consciousnessClass = 'con-clear';
      scope.injuryStatus       = 'Без травм';
      scope.injuryStatusClass  = 'inj-none';

      scope.bodyDamage = {
        head: 0, neck: 0, chest: 0, spine: 0, abdomen: 0,
        leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0,
      };
      scope.diagnoses    = [];
      scope.selectedZone = null;
      scope.zoneNames    = ZONE_NAMES;

      // Build initial factor rows
      scope.factorList = FACTORS.map(function (f) {
        return {
          key:       f.key,
          icon:      f.icon,
          label:     f.label,
          unit:      f.unit,
          maxPts:    f.maxPts,
          display:   '0 ' + f.unit,
          pts:       0,
          pct:       0,
          color:     '#00e676',
          riskLevel: 'low',
        };
      });

      // ── Zone interaction ───────────────────────────────────────────────────
      scope.selectZone = function (zone) {
        scope.selectedZone = (scope.selectedZone === zone) ? null : zone;
      };

      // ── Zone colour & glow ─────────────────────────────────────────────────
      scope.zoneColor = function (dmg) {
        if (dmg < 0.10) return '#1a2535';
        if (dmg < 0.30) return '#3d1a1a';
        if (dmg < 0.60) return '#7a1f1f';
        if (dmg < 0.80) return '#cc2a00';
        return '#ff1a00';
      };

      scope.zoneGlow = function (dmg) {
        if (dmg >= 0.80) return 'url(#glow-zone)';
        return 'none';
      };

      // ── Data handler ───────────────────────────────────────────────────────
      function generateDiagnoses(bd) {
        var result = [];
        Object.keys(DIAGNOSES).forEach(function (zone) {
          var dmg  = bd[zone] || 0;
          var list = DIAGNOSES[zone];
          for (var i = 0; i < list.length; i++) {
            if (dmg >= list[i].threshold) {
              result.push({ text: list[i].text, severity: list[i].severity });
              break;
            }
          }
        });
        // Sort: critical first
        result.sort(function (a, b) {
          var order = { critical: 0, warning: 1, mild: 2 };
          return order[a.severity] - order[b.severity];
        });
        return result;
      }

      function maxBodyDamage(bd) {
        var m = 0;
        Object.keys(bd).forEach(function (k) { if (bd[k] > m) m = bd[k]; });
        return m;
      }

      function onData(data) {
        var chance = Math.round(data.survivalChance || 100);
        scope.survivalChance = chance;
        scope.gaugeColor     = survivalColor(chance);
        scope.gaugeDash      = chance / 100 * CIRC;
        scope.gaugeGap       = CIRC - scope.gaugeDash;

        // Status label & root class
        if (chance >= 70) {
          scope.survivalStatus = 'БЕЗОПАСНО';
          scope.statusClass    = 'safe';
        } else if (chance >= 45) {
          scope.survivalStatus = 'ОСТОРОЖНО';
          scope.statusClass    = 'caution';
        } else if (chance >= 25) {
          scope.survivalStatus = 'ОПАСНО';
          scope.statusClass    = 'danger';
        } else {
          scope.survivalStatus = 'КРИТИЧНО';
          scope.statusClass    = 'critical';
        }

        // Update factor rows
        var risks = data.risks || {};
        var rawValues = {
          speed:    data.speed    || 0,
          damage:   data.damage   || 0,
          impact:   data.impactG  || 0,
          rotation: data.rotation || 0,
          tilt:     data.tilt     || 0,
          lateral:  data.lateralG || 0,
          fall:     data.fallSpeed|| 0,
          traffic:  data.trafficDist < 999 ? Math.round(data.trafficDist) : null,
          time:     data.timeLabel    || '',
          weather:  data.weatherLabel || '',
        };
        var unitOverride = {
          time:    '',
          weather: '',
          traffic: 'м',
        };

        scope.factorList.forEach(function (row) {
          var pts    = risks[row.key] || 0;
          var ratio  = pts / (row.maxPts || 1);
          var raw    = rawValues[row.key];
          var dispVal;
          if (raw === null || raw === undefined) {
            dispVal = '—';
          } else if (typeof raw === 'number') {
            dispVal = raw.toFixed(row.key === 'speed' || row.key === 'tilt' || row.key === 'traffic' ? 0 : 1);
            if (row.unit) dispVal += ' ' + row.unit;
          } else {
            dispVal = raw;
          }

          row.pts       = pts;
          row.pct       = Math.min(100, ratio * 100);
          row.color     = riskColor(ratio);
          row.riskLevel = riskLevel(ratio);
          row.display   = dispVal;
        });

        // Body damage
        if (data.bodyDamage) {
          scope.bodyDamage = data.bodyDamage;
        }
        scope.diagnoses = generateDiagnoses(scope.bodyDamage);

        // Consciousness
        if (chance >= 70) {
          scope.consciousness      = 'Сознание ясное';
          scope.consciousnessClass = 'con-clear';
        } else if (chance >= 50) {
          scope.consciousness      = 'Заторможенность';
          scope.consciousnessClass = 'con-dazed';
        } else if (chance >= 28) {
          scope.consciousness      = 'Потеря сознания';
          scope.consciousnessClass = 'con-out';
        } else {
          scope.consciousness      = 'Кома';
          scope.consciousnessClass = 'con-coma';
        }

        // Injury status
        var mbd = maxBodyDamage(scope.bodyDamage);
        if (mbd < 0.10) {
          scope.injuryStatus      = 'Без травм';
          scope.injuryStatusClass = 'inj-none';
        } else if (mbd < 0.40) {
          scope.injuryStatus      = 'Лёгкие травмы';
          scope.injuryStatusClass = 'inj-mild';
        } else if (mbd < 0.70) {
          scope.injuryStatus      = 'Средние травмы';
          scope.injuryStatusClass = 'inj-moderate';
        } else {
          scope.injuryStatus      = 'Критические травмы';
          scope.injuryStatusClass = 'inj-critical';
        }
      }

      // ── Event subscription ─────────────────────────────────────────────────
      var unsubscribe = scope.$on('survivalhudData', function (event, data) {
        scope.$apply(function () { onData(data); });
      });

      scope.$on('$destroy', unsubscribe);

      // ── Bootstrap: load GE extension ──────────────────────────────────────
      bngApi.engineLua('extensions.load("survivalhud_ge")');
    }
  };
}]);
