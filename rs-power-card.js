/*
 RS-Power-Card - Volledig Modulair
 Geschikt voor Home Assistant
 */

class RSPowerCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this._initialized = false;
    }

    setConfig(config) {
        if (!config)
            throw new Error("Ongeldige configuratie");
        this.config = config;
        this.maxPower = config.maxPower || 5000;
    }

    set hass(hass) {
        this._hass = hass;
        this.render();
    }

    render() {
        if (!this._hass || !this.config)
            return;

        if (!this._initialized) {
            this.initialRender();
        }

        this._updateData();
    }

    initialRender() {
        const groups = this.config.solar?.groups ?? [];
        const devices = this.config.home?.devices ?? [];

        // Centrale context voor SVG opbouw
        this.ctx = {
            paths: '',
            linesBg: '',
            linesMove: '',
            donuts: '',
            labels: '',
            currentY: 15,
            flatIdx: 0,
            animStartPos: 0,
            houseYCenter: 0
        };

        // 1. ZONNEPANELEN (LINKS)
        this._calculateBasePositions(groups);
        this._renderSolarGroups(groups);
        this._renderCorePaths();

        // 2. AFNEMERS (RECHTS) - Reset Y naar boven
        const savedSolarY = this.ctx.currentY;
        this.ctx.currentY = 15;
        this._renderDevices(devices);

        // 3. FINISH
        this.ctx.finalMaxY = Math.max(savedSolarY, this.ctx.currentY);
        this._assembleHTML();
        this._initialized = true;
    }

    // --- POSITIE LOGICA ---
    _calculateBasePositions(groups) {
        this.ctx.groupPositions = groups.map(group => {
            const pos = this.ctx.currentY;
            const rows = Math.ceil((group.entities || []).length / 4);
            this.ctx.currentY += (rows * 70) + 25;
            return pos;
        });
        this.ctx.animStartPos = this.ctx.currentY + 80;
        this.ctx.houseYCenter = this.ctx.animStartPos + 50;
    }

    // --- ZONNE-ENERGIE RENDERING ---
    _renderSolarGroups(groups) {
        groups.forEach((group, groupIdx) => {
            const startYPos = this.ctx.groupPositions[groupIdx];
            const relayY = startYPos + 32;
            const relayPathId = `path_relay_g${groupIdx}`;

            this.ctx.paths += `<path id="${relayPathId}" d="M 20 ${relayY} L 5 ${relayY} L 5 ${this.ctx.animStartPos} L 55 ${this.ctx.animStartPos}" />`;
            this.ctx.linesBg += `<use class="line-bg" href="#${relayPathId}" />`;
            this.ctx.linesMove += `<use class="line-move" id="move_relay_${groupIdx}" href="#${relayPathId}" />`;

            (group.entities || []).forEach((item, i) => {
                const col = i % 4;
                const row = Math.floor(i / 4);
                const x = 60 + (col * 93);
                const y = startYPos + 60 + (row * 70);
                const pathId = `path_g${groupIdx}_i${i}`;
                const turnY = y - 18 - 10;

                this.ctx.paths += `<path id="${pathId}" d="M ${x} ${y - 18} L ${x} ${turnY} L 20 ${turnY} L 20 ${relayY}" />`;
                this.ctx.linesBg += `<use class="line-bg" href="#${pathId}" />`;
                this.ctx.linesMove += `<use class="line-move" id="move_g${groupIdx}_i${i}" href="#${pathId}" />`;

                const inv = (typeof item === 'object') ? item : {entity: item};
                // Geef deviceMax door aan de donut helper voor de initiële tekening
                const deviceMax = inv.max || 300;
                this.ctx.donuts += this._renderDonutHelper(x, y, inv.color || "yellow", inv.icon || "🪩", inv.name || `P${i + 1}`, `g${groupIdx}_i${i}`, 18, 12, deviceMax);
            });

            this.ctx.labels += `<text x="35" y="${relayY - 20}" id="group_val_${groupIdx}" class="static-label"></text>
                                <text x="20" y="${relayY + 4}" id="relay_ico_${groupIdx}" text-anchor="middle" dominant-baseline="middle"></text>`;
        });
    }

    _renderCorePaths() {
        const animPos = this.ctx.animStartPos;
        const houseY = this.ctx.houseYCenter;
        this.ctx.paths += `<path id="path_zon_huis" d="M 80 ${animPos + 25} L 80 ${houseY} L 175 ${houseY}" />`;
        this.ctx.paths += `<path id="path_huis_net" d="M 225 ${houseY} L 320 ${houseY} L 320 ${animPos + 25}" />`;
    }

    // --- DEVICES RENDERING ---
    _renderDevices(devices) {
        const deviceStartX = 450;
        const hSpace = 93;
        const vSpace = 70;
        let gridCounter = 0;

        devices.forEach((d) => {
            const hasSubs = d.subdevices && d.subdevices.length > 0;
            if (hasSubs && gridCounter % 4 !== 0) {
                this.ctx.currentY += vSpace;
                gridCounter = 0;
            }

            const col = hasSubs ? 0 : (gridCounter % 4);
            const x = deviceStartX + (col * hSpace);
            const y = this.ctx.currentY + 60;

            this._drawMainBusPath(x, y);
            const deviceMax = d.max || 3200;
            this.ctx.donuts += this._renderDonutHelper(x, y, d.color || "lightgreen", d.icon || "🔌", d.name, `dev_${this.ctx.flatIdx}`, 18, 12, deviceMax);

            const px = x;
            const py = y;
            this.ctx.flatIdx++;

            if (hasSubs) {
                d.subdevices.forEach((sub, subIdx) => {
                    const sx = deviceStartX + ((subIdx % 3) + 1) * hSpace;
                    const sy = py + (Math.floor(subIdx / 3) + 1) * vSpace;
                    const subPathId = `path_dev_${this.ctx.flatIdx}`;
                    const branchY = sy - 18 - 10;

                    this.ctx.paths += `<path id="${subPathId}" d="M ${px} ${py + 20} L ${px} ${branchY} L ${sx} ${branchY} L ${sx} ${sy - 18}" />`;
                    this.ctx.linesBg += `<use class="line-bg" href="#${subPathId}" />`;
                    this.ctx.linesMove += `<use class="line-move" id="move_dev_${this.ctx.flatIdx}" href="#${subPathId}" />`;

                    const deviceMax = d.max || 3200;
                    this.ctx.donuts += this._renderDonutHelper(sx, sy, sub.color || "#00d2ff", sub.icon || "🔹", sub.name, `dev_${this.ctx.flatIdx}`, 18, 12, deviceMax);
                    this.ctx.flatIdx++;
                });
                this.ctx.currentY += (Math.ceil(d.subdevices.length / 3) + 1) * vSpace;
                gridCounter = 0;
            } else {
                gridCounter++;
                if (gridCounter % 4 === 0)
                    this.ctx.currentY += vSpace;
            }
        });
    }

    _drawMainBusPath(x, y) {
        const pathId = `path_dev_${this.ctx.flatIdx}`;
        const turnY = y - 18 - 10;
        const dropY = this.ctx.houseYCenter + 45;
        const d = `M 200 ${this.ctx.houseYCenter + 25} L 200 ${dropY} L 410 ${dropY} L 410 ${turnY} L ${x} ${turnY} L ${x} ${y - 18}`;

        this.ctx.paths += `<path id="${pathId}" pathLength="100" d="${d}" />`;
        this.ctx.linesBg += `<use class="line-bg" href="#${pathId}" />`;
        this.ctx.linesMove += `<use class="line-move" id="move_dev_${this.ctx.flatIdx}" href="#${pathId}" />`;
    }

    // --- DATA UPDATES ---
    _updateData() {
        const gatewayEntity = this.config.solar?.gateway?.entity;
        const solarTotal = gatewayEntity ? (parseFloat(this._hass.states[gatewayEntity]?.state) || 0) : 0;


        // Update Solar
        (this.config.solar?.groups ?? []).forEach((group, groupIdx) => {
            let groupTotal = 0;
            (group.entities || []).forEach((item, i) => {
                const eid = (typeof item === 'object') ? item.entity : item;
                const val = parseFloat(this._hass.states[eid]?.state) || 0;
                groupTotal += val;

                const energyEid = item.energy_entity;
                const energyVal = energyEid ? (this._hass.states[energyEid]?.state || "0") : null;

                const deviceMax = (typeof item === 'object') ? (item.max || 300) : 300;
                this.updateEntity(`g${groupIdx}_i${i}`, val, deviceMax, true, energyVal);
            });

            const gLabel = this.shadowRoot.getElementById(`group_val_${groupIdx}`);
            if (gLabel)
                gLabel.textContent = `${group.name}: ${Math.round(groupTotal)}W`;

            const relay = group.relay ? this._hass.states[group.relay]?.state : 'on';
            const ico = this.shadowRoot.getElementById(`relay_ico_${groupIdx}`);
            if (ico)
                ico.textContent = relay === 'on' ? '🟢' : '🔴';

            const moveRelay = this.shadowRoot.getElementById(`move_relay_${groupIdx}`);
            if (moveRelay) {
                const dur = groupTotal > 5 ? Math.max(1, 10 - (groupTotal / 200)) : 0;
                moveRelay.style.animationDuration = `${dur}s`;
                moveRelay.style.visibility = (relay === 'on' && groupTotal > 5) ? 'visible' : 'hidden';
            }
        });

        // Update Core
        const grid = parseFloat(this._hass.states[this.config.grid?.entity]?.state) || 0;
        const home = Math.max(0, solarTotal + grid);

        const totalConsumption = parseFloat(this._hass.states[this.config.grid?.energy_entity]?.state).toFixed(0) || "0.00";

        const limit = this.config.maxPower || 5000;
        this.updateEntity('zon', solarTotal, limit, null);
        this.updateEntity('huis', home, limit, null);
        this.updateEntity('net', grid, limit, false, totalConsumption);

        const moveNet = this.shadowRoot.getElementById('move_net');
        if (moveNet) {
            grid > 0 ? moveNet.classList.add('reverse') : moveNet.classList.remove('reverse');
            moveNet.style.visibility = Math.abs(grid) > 5 ? 'visible' : 'hidden';
        }

        // Update Devices
        let flatIdx = 0;
        (this.config.home?.devices ?? []).forEach((d) => {
            // We halen de waarde van het hoofdapparaat op
            let mainVal = parseFloat(this._hass.states[d.entity]?.state) || 0;
            
            // We berekenen subTotal nog wel voor de subdevices, maar trekken het niet meer af
            const subVals = (d.subdevices || []).map(sub => {
                return parseFloat(this._hass.states[sub.entity]?.state) || 0;
            });

            // kWh waarde ophalen voor het hoofdapparaat
            const energyEid = d.energy_entity;
            const energyVal = energyEid ? (parseFloat(this._hass.states[energyEid]?.state).toFixed(2) || "0.00") : null;

            const mainMax = d.max || 3200;
            // Hier tonen we nu de volledige mainVal
            this.updateEntity(`dev_${flatIdx}`, mainVal, mainMax, true, energyVal);
            flatIdx++;

            (d.subdevices || []).forEach((sub, sIdx) => {            
                // kWh waarde ophalen voor het subdevice
                const subEnergyEid = sub.energy_entity;
                const subEnergyVal = subEnergyEid ? (parseFloat(this._hass.states[subEnergyEid]?.state).toFixed(2) || "0.00") : null;
            
                const subMax = sub.max || 3200;
                this.updateEntity(`dev_${flatIdx}`, subVals[sIdx], subMax, true, subEnergyVal);
                flatIdx++;
            });
        });

    }

    // --- HELPERS ---
    updateEntity(id, val, max, isDevice = false, energyVal = null) {
        const valEl = this.shadowRoot.getElementById(`val_${id}`);
        const ringEl = this.shadowRoot.getElementById(`ring_${id}`);

        // 1. BEPAAL DE KLEUR (Groen bij negatief, anders origineel)
        let displayColor = "";
        if (val < -5) {
            displayColor = "#4caf50"; // Mooi groen
        }

        // 2. UPDATE TEKST
        if (valEl) {
            valEl.textContent = `${Math.round(val)}W`;
            if (displayColor) {
                valEl.style.fill = displayColor;
            } else if (ringEl) {
                // Alleen doen als ringEl ook echt bestaat
                valEl.style.fill = ringEl.getAttribute('stroke');
            }
        }


        // 3. UPDATE RING
        if (ringEl && max > 0) {
            const r = ringEl.getAttribute('r');
            const circumference = 2 * Math.PI * r;
            const offset = circumference - (Math.min(Math.abs(val), max) / max) * circumference;

            ringEl.style.strokeDashoffset = offset;

            // Pas de kleur van de ring aan
            if (displayColor) {
                ringEl.style.stroke = displayColor;
            } else {
                // Reset naar de originele kleur (deze staat in het 'stroke' attribuut van de HTML)
                ringEl.style.stroke = ringEl.getAttribute('stroke');
            }
        }

        // 4. ANIMATIE
        const moveEl = this.shadowRoot.getElementById(`move_${id}`);
        if (moveEl) {
            const absVal = Math.abs(val);
            const dur = isDevice ? Math.max(0.5, 4 - (absVal / 500)) : Math.max(0.4, 3 - (absVal / 500));
            moveEl.style.animationDuration = `${absVal > 5 ? dur : 0}s`;
            moveEl.style.visibility = absVal > 5 ? 'visible' : 'hidden';
        }

        // 5. EXTRA TOEVOEGING STROOMVERBRUIK
        const energyEl = this.shadowRoot.getElementById(`energy_${id}`);
        if (energyEl) {
            // Check of energyVal bestaat, niet nul is en niet de tekst "---" is
            if (energyVal && energyVal !== 0 && energyVal !== "0.00" && energyVal !== "---") {
                energyEl.textContent = `${energyVal} kWh`;
            } else {
                energyEl.textContent = ""; // Maak het veld leeg als er geen info is
            }
        }

    }

    _renderDonutHelper(x, y, color, icon, name, id, radius = 18, fontsize = 12, maxPower = 3200) {
        // We geven hier alle waarden in de juiste volgorde door
        return `<g>${this.renderDonutStatic(x, y, color, icon, name, id, radius, fontsize, maxPower)}</g>`;
    }

    renderDonutStatic(x, y, color, icon, label, id, radius, fontsize, maxPower) {
        // Bereken de omtrek dynamisch: 2 * PI * r
        const circumference = 2 * Math.PI * radius;
        const iconSize = radius * 1.3; // Icoon schaalt mee met de cirkel

        return `
        <circle cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="#333" stroke-width="5" />
        <circle id="ring_${id}" data-max="${maxPower}" cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="${color}" 
                stroke-width="5" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" 
                stroke-linecap="round" transform="rotate(-90 ${x} ${y})" style="transition: stroke-dashoffset 0.5s ease" />
        
        <!-- Icoon in het midden (gecentreerd) -->
        <text x="${x}" y="${y + 3}" text-anchor="middle" dominant-baseline="middle" font-size="${iconSize}px">${icon}</text>        
        
        <!-- Teksten aan de zijkant -->
        <text x="${x + radius + 8}" y="${y - 2}" text-anchor="start" font-size="${fontsize}px" class="static-label">${label}</text>
        <text x="${x + radius + 8}" y="${y + fontsize + 2}" id="val_${id}" text-anchor="start" font-size="${fontsize}px" style="fill: ${color}; font-weight: bold;">0W</text>
        <text x="${x + radius + 8}" y="${y + (fontsize * 2) + 2}" id="energy_${id}" text-anchor="start" font-size="${fontsize - 2}px" style="fill: #888;"></text>
        `;
    }

    _assembleHTML() {
        const totalHeight = Math.max(this.ctx.animStartPos + 100, this.ctx.finalMaxY + 100);
        this.shadowRoot.innerHTML = `
            <style>
                .flow { width: 100%; height: auto; display: block; }        
                .line-bg { fill: none; stroke: #333333; stroke-width: 2px; shape-rendering: crispEdges; }
                .line-move { stroke: #fff; stroke-width: 6; stroke-linecap: round; stroke-dasharray: 0.3, 100; fill: none; filter: drop-shadow(0px 0px 8px #00ffcc); animation: flow-animation 3s linear infinite; }
                .line-move.reverse { animation-direction: reverse; }
                @keyframes flow-animation { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
                .static-label { font-size: 13px; fill: var(--primary-text-color); font-family: sans-serif; }
            </style>
            <ha-card>
                <svg class="flow" viewBox="0 0 850 ${totalHeight}">
                    <defs>${this.ctx.paths}</defs>
                    <g id="layer-bg">${this.ctx.linesBg}<use class="line-bg" href="#path_zon_huis" /><use class="line-bg" href="#path_huis_net" /></g>
                    <g id="layer-move">${this.ctx.linesMove}<use class="line-move" id="move_zon" href="#path_zon_huis" /><use class="line-move" id="move_net" href="#path_huis_net" /></g>
                    <g id="layer-donuts">${this.ctx.donuts}                        
                        ${this._renderDonutHelper(80, this.ctx.animStartPos, "#ff9800", "☀️", "Zon", "zon", 25, 12)}
                        ${this._renderDonutHelper(200, this.ctx.houseYCenter, "#2196f3", "🏠", "Huis", "huis", 25, 12)}
                        ${this._renderDonutHelper(320, this.ctx.animStartPos, "#8353d1", "🔌", "Net", "net", 25, 12)}
                    </g>
                    <g id="layer-labels">${this.ctx.labels}</g>
                </svg>
            </ha-card>`;
    }
}

customElements.define("rs-power-card", RSPowerCard);
