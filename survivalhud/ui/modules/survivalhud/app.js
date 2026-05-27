'use strict';

/**
 * Survival HUD — BeamNG.drive UI App
 * Inline template edition: no external templateUrl needed.
 */

// ─── Inline HTML template ──────────────────────────────────────────────────
var _TPL = [
'<div class="shud-root" ng-class="statusClass">',

  // Tab bar
  '<div class="shud-tabs">',
    '<button class="shud-tab" ng-class="{active: activeTab===\'chance\'}" ng-click="activeTab=\'chance\'">',
      '<span class="tab-icon">&#9889;</span> ШАНС',
    '</button>',
    '<button class="shud-tab" ng-class="{active: activeTab===\'driver\'}" ng-click="activeTab=\'driver\'">',
      '<span class="tab-icon">&#x1FAC0;</span> ВОДИТЕЛЬ',
    '</button>',
  '</div>',

  // ── TAB 1: ШАНС ──
  '<div class="shud-panel" ng-show="activeTab===\'chance\'">',

    '<div class="shud-gauge-wrap" ng-click="showFactors=!showFactors">',
      '<svg class="shud-gauge-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">',
        '<defs>',
          '<filter id="shud-glow-g" x="-30%" y="-30%" width="160%" height="160%">',
            '<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>',
            '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>',
          '</filter>',
        '</defs>',
        // Track ring
        '<circle cx="100" cy="100" r="82" fill="none" stroke="#1e2a3a" stroke-width="14"/>',
        // Progress arc
        '<circle cx="100" cy="100" r="82" fill="none"',
          'ng-attr-stroke="{{gaugeColor}}"',
          'stroke-width="14" stroke-linecap="round"',
          'ng-attr-stroke-dasharray="{{gaugeDash}} {{gaugeGap}}"',
          'transform="rotate(-90,100,100)"',
          'class="shud-arc"/>',
        // Tick marks
        '<g stroke="#2a3a4a" stroke-width="1.5">',
          '<line x1="100" y1="12" x2="100" y2="22" transform="rotate(0,100,100)"/>',
          '<line x1="100" y1="12" x2="100" y2="22" transform="rotate(36,100,100)"/>',
          '<line x1="100" y1="12" x2="100" y2="22" transform="rotate(72,100,100)"/>',
          '<line x1="100" y1="12" x2="100" y2="22" transform="rotate(108,100,100)"/>',
          '<line x1="100" y1="12" x2="100" y2="22" transform="rotate(144,100,100)"/>',
          '<line x1="100" y1="12" x2="100" y2="22" transform="rotate(180,100,100)"/>',
          '<line x1="100" y1="12" x2="100" y2="22" transform="rotate(216,100,100)"/>',
          '<line x1="100" y1="12" x2="100" y2="22" transform="rotate(252,100,100)"/>',
          '<line x1="100" y1="12" x2="100" y2="22" transform="rotate(288,100,100)"/>',
          '<line x1="100" y1="12" x2="100" y2="22" transform="rotate(324,100,100)"/>',
        '</g>',
        // Center text
        '<text x="100" y="90" class="shud-pct-text" text-anchor="middle" dominant-baseline="middle"',
          'ng-attr-fill="{{gaugeColor}}">{{survivalChance}}%</text>',
        '<text x="100" y="120" class="shud-status-text" text-anchor="middle" dominant-baseline="middle"',
          'ng-attr-fill="{{gaugeColor}}">{{survivalStatus}}</text>',
        '<text x="100" y="148" class="shud-hint-text" text-anchor="middle" dominant-baseline="middle"',
          'fill="#3a4a5a">{{showFactors ? "&#9650; скрыть" : "&#9660; факторы"}}</text>',
      '</svg>',
    '</div>',

    // Risk factor list
    '<div class="shud-factors" ng-show="showFactors">',
      '<div class="shud-factor-row" ng-repeat="f in factorList" ng-class="\'risk-\' + f.riskLevel">',
        '<span class="shud-f-icon">{{f.icon}}</span>',
        '<span class="shud-f-label">{{f.label}}</span>',
        '<span class="shud-f-value">{{f.display}}</span>',
        '<div class="shud-f-bar-wrap">',
          '<div class="shud-f-bar" ng-style="{width: f.pct+\'%\', background: f.color}"></div>',
        '</div>',
        '<span class="shud-f-pts" ng-style="{color: f.color}">&minus;{{f.pts | number:1}}</span>',
      '</div>',
    '</div>',

  '</div>', // /tab chance

  // ── TAB 2: ВОДИТЕЛЬ ──
  '<div class="shud-panel shud-driver-panel" ng-show="activeTab===\'driver\'">',

    // Status strip
    '<div class="shud-status-strip">',
      '<div class="shud-consciousness" ng-class="consciousnessClass">',
        '<span class="strip-icon">&#x1F9E0;</span>',
        '<span>{{consciousness}}</span>',
      '</div>',
      '<div class="shud-injury-status" ng-class="injuryStatusClass">',
        '<span class="strip-icon">&#x1FA7A;</span>',
        '<span>{{injuryStatus}}</span>',
      '</div>',
    '</div>',

    // Body + diagnoses
    '<div class="shud-body-row">',

      // SVG silhouette
      '<svg class="shud-body-svg" viewBox="0 0 100 240" xmlns="http://www.w3.org/2000/svg">',
        '<defs>',
          '<filter id="shud-glow-z" x="-40%" y="-40%" width="180%" height="180%">',
            '<feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>',
            '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>',
          '</filter>',
        '</defs>',
        // Arms (behind torso — rendered first)
        '<rect x="7" y="48" width="19" height="68" rx="8"',
          'ng-attr-fill="{{zoneColor(bodyDamage.leftArm)}}"',
          'ng-attr-filter="{{zoneGlow(bodyDamage.leftArm)}}"',
          'class="shud-zone" ng-click="selectZone(\'leftArm\')"',
          'ng-class="{selected: selectedZone===\'leftArm\'}"/>',
        '<rect x="74" y="48" width="19" height="68" rx="8"',
          'ng-attr-fill="{{zoneColor(bodyDamage.rightArm)}}"',
          'ng-attr-filter="{{zoneGlow(bodyDamage.rightArm)}}"',
          'class="shud-zone" ng-click="selectZone(\'rightArm\')"',
          'ng-class="{selected: selectedZone===\'rightArm\'}"/>',
        // Legs
        '<rect x="30" y="122" width="18" height="95" rx="6"',
          'ng-attr-fill="{{zoneColor(bodyDamage.leftLeg)}}"',
          'ng-attr-filter="{{zoneGlow(bodyDamage.leftLeg)}}"',
          'class="shud-zone" ng-click="selectZone(\'leftLeg\')"',
          'ng-class="{selected: selectedZone===\'leftLeg\'}"/>',
        '<rect x="52" y="122" width="18" height="95" rx="6"',
          'ng-attr-fill="{{zoneColor(bodyDamage.rightLeg)}}"',
          'ng-attr-filter="{{zoneGlow(bodyDamage.rightLeg)}}"',
          'class="shud-zone" ng-click="selectZone(\'rightLeg\')"',
          'ng-class="{selected: selectedZone===\'rightLeg\'}"/>',
        // Abdomen
        '<rect x="30" y="93" width="40" height="28" rx="5"',
          'ng-attr-fill="{{zoneColor(bodyDamage.abdomen)}}"',
          'ng-attr-filter="{{zoneGlow(bodyDamage.abdomen)}}"',
          'class="shud-zone" ng-click="selectZone(\'abdomen\')"',
          'ng-class="{selected: selectedZone===\'abdomen\'}"/>',
        // Chest
        '<rect x="28" y="46" width="44" height="46" rx="6"',
          'ng-attr-fill="{{zoneColor(bodyDamage.chest)}}"',
          'ng-attr-filter="{{zoneGlow(bodyDamage.chest)}}"',
          'class="shud-zone" ng-click="selectZone(\'chest\')"',
          'ng-class="{selected: selectedZone===\'chest\'}"/>',
        // Spine (overlay)
        '<rect x="47" y="46" width="6" height="72" rx="3"',
          'ng-attr-fill="{{zoneColor(bodyDamage.spine)}}"',
          'ng-attr-filter="{{zoneGlow(bodyDamage.spine)}}"',
          'class="shud-zone shud-zone-spine" ng-click="selectZone(\'spine\')"',
          'ng-class="{selected: selectedZone===\'spine\'}"/>',
        // Neck
        '<rect x="44" y="37" width="12" height="10" rx="3"',
          'ng-attr-fill="{{zoneColor(bodyDamage.neck)}}"',
          'ng-attr-filter="{{zoneGlow(bodyDamage.neck)}}"',
          'class="shud-zone" ng-click="selectZone(\'neck\')"',
          'ng-class="{selected: selectedZone===\'neck\'}"/>',
        // Head
        '<circle cx="50" cy="21" r="17"',
          'ng-attr-fill="{{zoneColor(bodyDamage.head)}}"',
          'ng-attr-filter="{{zoneGlow(bodyDamage.head)}}"',
          'class="shud-zone" ng-click="selectZone(\'head\')"',
          'ng-class="{selected: selectedZone===\'head\'}"/>',
        // Helmet arc decoration
        '<ellipse cx="50" cy="15" rx="12" ry="5"',
          'fill="none" stroke="#2a3a4a" stroke-width="1.2" opacity="0.6"/>',
        // Selected zone label
        '<text x="50" y="232" text-anchor="middle" class="shud-zone-label"',
          'fill="#7a9ab8" ng-show="selectedZone">{{zoneNames[selectedZone]}}</text>',
      '</svg>',

      // Diagnoses
      '<div class="shud-diagnoses">',
        '<div class="shud-diag-title">Диагнозы</div>',
        '<div ng-if="diagnoses.length === 0" class="shud-no-injury">',
          '<span>&#10003;</span> Травм нет',
        '</div>',
        '<div class="shud-diag-item" ng-repeat="d in diagnoses" ng-class="\'sev-\' + d.severity">',
          '<span class="diag-sev-dot"></span>',
          '<span class="diag-text">{{d.text}}</span>',
        '</div>',
      '</div>',

    '</div>', // /body-row
  '</div>', // /tab driver

'</div>'  // /shud-root
].join('');


// ─── Diagnosis database ────────────────────────────────────────────────────
var DIAGNOSES = {
  head:     [{t:0.75,text:'Черепно-мозговая травма',   sev:'critical'},
             {t:0.45,text:'Сотрясение мозга',           sev:'warning' },
             {t:0.15,text:'Ушиб головы',                sev:'mild'    }],
  neck:     [{t:0.75,text:'Перелом шейных позвонков',   sev:'critical'},
             {t:0.45,text:'Хлыстовая травма',           sev:'warning' },
             {t:0.15,text:'Растяжение шеи',             sev:'mild'    }],
  chest:    [{t:0.75,text:'Проникающая травма груди',   sev:'critical'},
             {t:0.45,text:'Перелом рёбер',              sev:'warning' },
             {t:0.15,text:'Ушиб грудной клетки',        sev:'mild'    }],
  spine:    [{t:0.75,text:'Перелом позвоночника',       sev:'critical'},
             {t:0.45,text:'Компрессия позвоночника',    sev:'warning' },
             {t:0.15,text:'Растяжение спины',           sev:'mild'    }],
  abdomen:  [{t:0.75,text:'Внутреннее кровотечение',   sev:'critical'},
             {t:0.45,text:'Травма внутренних органов',  sev:'warning' },
             {t:0.15,text:'Ушиб живота',                sev:'mild'    }],
  leftArm:  [{t:0.75,text:'Перелом левой руки',         sev:'critical'},
             {t:0.45,text:'Вывих левого плеча',         sev:'warning' },
             {t:0.15,text:'Ушиб левой руки',            sev:'mild'    }],
  rightArm: [{t:0.75,text:'Перелом правой руки',        sev:'critical'},
             {t:0.45,text:'Вывих правого плеча',        sev:'warning' },
             {t:0.15,text:'Ушиб правой руки',           sev:'mild'    }],
  leftLeg:  [{t:0.75,text:'Перелом левой ноги',         sev:'critical'},
             {t:0.45,text:'Разрыв связок левого колена',sev:'warning' },
             {t:0.15,text:'Ушиб левой ноги',            sev:'mild'    }],
  rightLeg: [{t:0.75,text:'Перелом правой ноги',        sev:'critical'},
             {t:0.45,text:'Разрыв связок правого колена',sev:'warning'},
             {t:0.15,text:'Ушиб правой ноги',           sev:'mild'    }]
};

var ZONE_NAMES = {
  head:'Голова', neck:'Шея', chest:'Грудная клетка', spine:'Позвоночник',
  abdomen:'Живот', leftArm:'Левая рука', rightArm:'Правая рука',
  leftLeg:'Левая нога', rightLeg:'Правая нога'
};

var FACTORS = [
  {key:'speed',   icon:'&#x1F697;', label:'Скорость',         unit:'км/ч', maxPts:15},
  {key:'damage',  icon:'&#x1F4A5;', label:'Повреждения',      unit:'%',    maxPts:25},
  {key:'impact',  icon:'&#x26A1;',  label:'Удар (G)',         unit:'G',    maxPts:25},
  {key:'rotation',icon:'&#x1F300;', label:'Вращение',         unit:'рад/с',maxPts:12},
  {key:'tilt',    icon:'&#x1F4D0;', label:'Наклон',           unit:'°',    maxPts:10},
  {key:'lateral', icon:'&#x2194;',  label:'Боковая нагрузка', unit:'G',    maxPts: 8},
  {key:'fall',    icon:'&#x2B07;',  label:'Падение',          unit:'м/с',  maxPts:12},
  {key:'traffic', icon:'&#x1F6A6;', label:'Трафик рядом',    unit:'м',    maxPts: 8},
  {key:'time',    icon:'&#x1F319;', label:'Время суток',      unit:'',     maxPts: 3},
  {key:'weather', icon:'&#x1F327;', label:'Осадки',           unit:'',     maxPts: 5}
];

var CIRC = 2 * Math.PI * 82; // ≈ 515.2

// ─── Helpers ───────────────────────────────────────────────────────────────
function survivalColor(p) {
  if (p >= 70) return '#00e676';
  if (p >= 45) return '#ffcc00';
  if (p >= 25) return '#ff6d00';
  return '#ff1744';
}
function riskColor(r) {
  if (r < 0.3)  return '#00e676';
  if (r < 0.6)  return '#ffcc00';
  if (r < 0.85) return '#ff6d00';
  return '#ff1744';
}
function riskLevel(r) {
  if (r < 0.3)  return 'low';
  if (r < 0.6)  return 'medium';
  if (r < 0.85) return 'high';
  return 'critical';
}

// ─── Directive ─────────────────────────────────────────────────────────────
angular.module('beamng.apps').directive('survivalhud', [function () {
  return {
    template:  _TPL,
    replace:   false,
    restrict:  'EA',
    link: function (scope) {

      // ── Initial scope ────────────────────────────────────────────────────
      scope.activeTab          = 'chance';
      scope.showFactors        = false;
      scope.survivalChance     = 100;
      scope.survivalStatus     = 'БЕЗОПАСНО';
      scope.statusClass        = 'safe';
      scope.gaugeColor         = '#00e676';
      scope.gaugeDash          = CIRC;
      scope.gaugeGap           = 0;
      scope.consciousness      = 'Сознание ясное';
      scope.consciousnessClass = 'con-clear';
      scope.injuryStatus       = 'Без травм';
      scope.injuryStatusClass  = 'inj-none';
      scope.bodyDamage         = {head:0,neck:0,chest:0,spine:0,abdomen:0,
                                   leftArm:0,rightArm:0,leftLeg:0,rightLeg:0};
      scope.diagnoses   = [];
      scope.selectedZone = null;
      scope.zoneNames   = ZONE_NAMES;

      scope.factorList = FACTORS.map(function(f) {
        return {key:f.key, icon:f.icon, label:f.label, unit:f.unit,
                maxPts:f.maxPts, display:'0', pts:0, pct:0,
                color:'#00e676', riskLevel:'low'};
      });

      // ── Zone helpers ─────────────────────────────────────────────────────
      scope.selectZone = function(z) {
        scope.selectedZone = (scope.selectedZone === z) ? null : z;
      };
      scope.zoneColor = function(d) {
        if (d < 0.10) return '#1a2535';
        if (d < 0.30) return '#3d1a1a';
        if (d < 0.60) return '#7a1f1f';
        if (d < 0.80) return '#cc2a00';
        return '#ff1a00';
      };
      scope.zoneGlow = function(d) {
        return d >= 0.80 ? 'url(#shud-glow-z)' : 'none';
      };

      // ── Data processing ──────────────────────────────────────────────────
      function buildDiagnoses(bd) {
        var out = [];
        Object.keys(DIAGNOSES).forEach(function(zone) {
          var dmg = bd[zone] || 0;
          var list = DIAGNOSES[zone];
          for (var i = 0; i < list.length; i++) {
            if (dmg >= list[i].t) {
              out.push({text: list[i].text, severity: list[i].sev});
              break;
            }
          }
        });
        out.sort(function(a,b) {
          return ({critical:0,warning:1,mild:2}[a.severity]||3) -
                 ({critical:0,warning:1,mild:2}[b.severity]||3);
        });
        return out;
      }

      function maxDmg(bd) {
        var m = 0;
        Object.keys(bd).forEach(function(k){ if (bd[k]>m) m=bd[k]; });
        return m;
      }

      function onData(data) {
        var pct = Math.round(data.survivalChance || 100);
        scope.survivalChance = pct;
        scope.gaugeColor     = survivalColor(pct);
        scope.gaugeDash      = pct / 100 * CIRC;
        scope.gaugeGap       = CIRC - scope.gaugeDash;

        if      (pct >= 70) { scope.survivalStatus='БЕЗОПАСНО'; scope.statusClass='safe';     }
        else if (pct >= 45) { scope.survivalStatus='ОСТОРОЖНО'; scope.statusClass='caution';  }
        else if (pct >= 25) { scope.survivalStatus='ОПАСНО';    scope.statusClass='danger';   }
        else                { scope.survivalStatus='КРИТИЧНО';  scope.statusClass='critical'; }

        var risks = data.risks || {};
        var rawV = {
          speed: data.speed||0, damage: data.damage||0,
          impact: data.impactG||0, rotation: data.rotation||0,
          tilt: data.tilt||0, lateral: data.lateralG||0,
          fall: data.fallSpeed||0,
          traffic: (data.trafficDist < 900) ? Math.round(data.trafficDist) : null,
          time: data.timeLabel||'', weather: data.weatherLabel||''
        };

        scope.factorList.forEach(function(row) {
          var pts   = risks[row.key] || 0;
          var ratio = pts / (row.maxPts || 1);
          var raw   = rawV[row.key];
          var disp;
          if (raw === null || raw === undefined) { disp = '—'; }
          else if (typeof raw === 'number') {
            disp = raw.toFixed(row.key==='speed'||row.key==='tilt'||row.key==='traffic'?0:1);
            if (row.unit) disp += ' ' + row.unit;
          } else { disp = raw || '—'; }
          row.pts       = pts;
          row.pct       = Math.min(100, ratio * 100);
          row.color     = riskColor(ratio);
          row.riskLevel = riskLevel(ratio);
          row.display   = disp;
        });

        if (data.bodyDamage) scope.bodyDamage = data.bodyDamage;
        scope.diagnoses = buildDiagnoses(scope.bodyDamage);

        if      (pct >= 70) { scope.consciousness='Сознание ясное'; scope.consciousnessClass='con-clear'; }
        else if (pct >= 50) { scope.consciousness='Заторможенность'; scope.consciousnessClass='con-dazed'; }
        else if (pct >= 28) { scope.consciousness='Потеря сознания'; scope.consciousnessClass='con-out'; }
        else                { scope.consciousness='Кома';            scope.consciousnessClass='con-coma'; }

        var md = maxDmg(scope.bodyDamage);
        if      (md < 0.10) { scope.injuryStatus='Без травм';         scope.injuryStatusClass='inj-none';     }
        else if (md < 0.40) { scope.injuryStatus='Лёгкие травмы';     scope.injuryStatusClass='inj-mild';     }
        else if (md < 0.70) { scope.injuryStatus='Средние травмы';    scope.injuryStatusClass='inj-moderate'; }
        else                { scope.injuryStatus='Критические травмы';scope.injuryStatusClass='inj-critical'; }
      }

      // ── Event listener ───────────────────────────────────────────────────
      var unsub = scope.$on('survivalhudData', function(ev, data) {
        scope.$apply(function(){ onData(data); });
      });
      scope.$on('$destroy', unsub);

      // ── Bootstrap GE extension ───────────────────────────────────────────
      if (typeof bngApi !== 'undefined') {
        bngApi.engineLua('extensions.load("survivalhud_ge")');
      }
    }
  };
}]);
