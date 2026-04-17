class RsPowerCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this._initialized = false;
    }

    setConfig(config) {
        this.config = config;
    }

    set hass(hass) {
        this._hass = hass;
        this.render();
    }

    initialRender() {
        const groups = this.config.solar?.groups ?? [];
        const devices = (this.config.home?.devices ?? []);
        // 1. BASIS POSITIES BEREKENEN
        let currentYPos = 15;
        const groupPositions = groups.map(group => {
            const pos = currentYPos;
            const rows = Math.ceil((group.entities || []).length / 4);
            currentYPos += (rows * 70) + 25;
            return pos;
        });
        const flowBoxY = currentYPos + 5;
        const animStartPos = flowBoxY + 75;
        const shiftY = 50;
        const houseYCenter = animStartPos + shiftY;
        const deviceRows = Math.ceil(devices.length / 3);
        // 2. LEGE VERGAARBAKKEN VOOR DE LAGEN
        let allPaths = '';
        let allLinesBg = '';
        let allLinesMove = '';
        let allDonuts = '';
        let allLabels = '';
        // 3. GROEPEN (INVERTERS) VERWERKEN
        groups.forEach((group, groupIdx) => {
            const inverters = group.entities || [];
            const startYPos = groupPositions[groupIdx];
            const relayY = startYPos + 32;
            const relayPathId = `path_relay_g${groupIdx}`;
            allPaths += `<path id="${relayPathId}" d="M 20 ${relayY} L 5 ${relayY} L 5 ${animStartPos} L 55 ${animStartPos}" />`;
            allLinesBg += `<use class="line-bg" href="#${relayPathId}" />`;
            allLinesMove += `<use class="line-move" id="move_relay_${groupIdx}" href="#${relayPathId}" />`;
            inverters.forEach((item, i) => {
                const col = i % 4;
                const row = Math.floor(i / 4);
                const x = 60 + (col * 93);
                const y = startYPos + 60 + (row * 70);
                const pathId = `path_g${groupIdx}_i${i}`;
                const turnY = (y - 18) - 10;
                allPaths += `<path id="${pathId}" d="M ${x} ${y - 18} L ${x} ${turnY} L 20 ${turnY} L 20 ${relayY}" />`;
                allLinesBg += `<use class="line-bg" href="#${pathId}" />`;
                allLinesMove += `<use class="line-move" id="move_g${groupIdx}_i${i}" href="#${pathId}" />`;
                allDonuts += `<g>${this.renderDonutStatic(x, y, "yellow", "🪩", `P${i + 1}`, `g${groupIdx}_i${i}`, 25, 9)}</g>`;
            });
            allLabels += `<text x="35" y="${relayY - 20}" id="group_val_${groupIdx}" class="static-label"></text>
                              <text x="20" y="${relayY + 4}" id="relay_ico_${groupIdx}" text-anchor="middle" dominant-baseline="middle"></text>`;
        });
        // 4. BASIS PADEN (ZON/HUIS/NET)
        allPaths += `<path id="path_zon_huis" d="M 80 ${animStartPos + 25} L 80 ${animStartPos + shiftY} L 175 ${animStartPos + shiftY}" />`;
        allPaths += `<path id="path_huis_net" d="M 225 ${animStartPos + shiftY} L 320 ${animStartPos + shiftY} L 320 ${animStartPos + 25}" />`;
        // 5. AFNEMERS (DEVICES) VERWERKEN
        const houseX = 200;
        const deviceStartX = 450;
        const deviceBusX = 410;
        const deviceStartY = 15;
        const maxcols = 4;
        devices.forEach((d, i) => {
            const col = i % maxcols;
            const row = Math.floor(i / maxcols);
            const x = deviceStartX + (col * 93);
            const y = deviceStartY + 60 + (row * 70);
            const pathId = `path_dev_${i}`;

            let pathD = "";

            // Check of dit apparaat een parent heeft
            if (d.parent) {
                const parentIdx = devices.findIndex(dev => dev.entity === d.parent);
                if (parentIdx !== -1) {
                    const pCol = parentIdx % maxcols;
                    const pRow = Math.floor(parentIdx / maxcols);
                    const px = deviceStartX + (pCol * 93);
                    const py = deviceStartY + 60 + (pRow * 70);

                    // We starten 25px onder het midden van de parent (onderkant donut)
                    // Daarna een klein stukje omlaag (15px) en dan opzij naar de kolom van het kind
                    const branchY = py + 40;
                    pathD = `M ${px} ${py + 18} L ${px} ${branchY} L ${x} ${branchY} L ${x} ${y - 18}`;
                }
            }


            // Als er geen parent is, of parent niet gevonden, gebruik het oude pad naar het huis
            if (!pathD) {
                const dropY = houseYCenter + 45;
                const turnY = y - 27;
                pathD = `M ${houseX} ${houseYCenter + 25} L ${houseX} ${dropY} L ${deviceBusX} ${dropY} L ${deviceBusX} ${turnY} L ${x} ${turnY} L ${x} ${y - 18}`;
            }

            allPaths += `<path id="${pathId}" pathLength="100" d="${pathD}" />`;
            allLinesBg += `<use class="line-bg" href="#${pathId}" />`;
            allLinesMove += `<use class="line-move" id="move_dev_${i}" href="#${pathId}" />`;
            allDonuts += `<g>${this.renderDonutStatic(x, y, "lightgreen", "🔌", d.name, `dev_${i}`, 25, 9)}</g>`;
        });

        // 6. HOOGTE EN RENDEREN
        const totalHeight = Math.max(animStartPos + shiftY + 50, deviceStartY + 60 + (deviceRows * 70) + 50);
        this.shadowRoot.innerHTML = `
            <style>
                .flow { width: 100%; height: auto; display: block; }        
                .line-bg { fill: none; stroke: #333333; stroke-width: 2px; shape-rendering: crispEdges; }
                .line-move { 
                    stroke: #fff; stroke-width: 6; stroke-linecap: round; 
                    stroke-dasharray: 0.3, 100; fill: none; 
                    filter: drop-shadow(0px 0px 8px #00ffcc);
                    animation: flow-animation 3s linear infinite; 
                }
                /* Haal de .reverse uit de .line-move block */
                .line-move.reverse { animation-direction: reverse; }

                @keyframes flow-animation { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
                .static-label { font-size: 15px; fill: var(--primary-text-color); }
            </style>
            <ha-card>
                <svg class="flow" viewBox="0 0 800 ${totalHeight}">
                    <defs>${allPaths}</defs>
                    <g id="layer-bg">${allLinesBg}
                        <use class="line-bg" href="#path_zon_huis" />
                        <use class="line-bg" href="#path_huis_net" />
                    </g>
                    <g id="layer-move">${allLinesMove}
                        <use class="line-move" id="move_zon" href="#path_zon_huis" />
                        <use class="line-move" id="move_net" href="#path_huis_net" />
                    </g>
                    <g id="layer-donuts">${allDonuts}
                        ${this.renderDonutStatic(80, animStartPos, "#ff9800", "☀️", "Zon", "zon", 25, 8, 25)}
                        ${this.renderDonutStatic(200, houseYCenter, "#2196f3", "🏠", "Huis", "huis", 25, 8, 25)}
                        ${this.renderDonutStatic(320, animStartPos, "#8353d1", "🔌", "Net", "net", 25, 8, 25)}
                    </g>
                    <g id="layer-labels">${allLabels}</g>
                </svg>
            </ha-card>`;
        this._initialized = true;
    }

    renderDonutStatic(x, y, color, icon, label, id, iconSize = 14, iconY = 5, radius = 18, fontsize = 14) {
        return `
        <circle cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="#444" stroke-width="5" />
        <circle id="ring_${id}" cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="${color}" stroke-width="5" stroke-dasharray="113" stroke-dashoffset="113" stroke-linecap="round" transform="rotate(-90 ${x} ${y})" />
        
        <!-- Hier gebruiken we nu de nieuwe variabelen -->
        <text x="${x}" y="${y + iconY}" text-anchor="middle" font-size="${iconSize}px">${icon}</text>        
        
        <text x="${x + 5 + radius}" y="${y - 4}" text-anchor="start" font-size="${fontsize}px" fill="var(--primary-text-color)">${label}</text>
        <text x="${x + 5 + radius}" y="${y + fontsize}" id="val_${id}" text-anchor="start" font-size="${fontsize}px" style="fill: ${color}">0W</text>
        `;
    }

    render() {
        if (!this._hass || !this.config)
            return;
        if (!this._initialized)
            this.initialRender();
        const gatewayEntity = this.config.solar?.gateway?.entity;
        const solarTotal = gatewayEntity ? (parseFloat(this._hass.states[gatewayEntity]?.state) || 0) : 0;
        const groups = this.config.solar?.groups ?? [];
        groups.forEach((group, groupIdx) => {
            let groupTotal = 0;
            (group.entities || []).forEach((item, i) => {
                const eid = (typeof item === 'object' && item !== null) ? item.entity : item;
                const val = parseFloat(this._hass.states[eid]?.state ?? 0);
                groupTotal += isNaN(val) ? 0 : val;
                this.updateEntity(`g${groupIdx}_i${i}`, val, 420);
            });
            const groupLabel = this.shadowRoot.getElementById(`group_val_${groupIdx}`);
            if (groupLabel)
                groupLabel.textContent = `${group.name}: ${Math.round(groupTotal)}W`;
            const relayState = group.relay ? this._hass.states[group.relay]?.state : 'on';
            const relayIco = this.shadowRoot.getElementById(`relay_ico_${groupIdx}`);
            if (relayIco)
                relayIco.textContent = relayState === 'on' ? '🟢' : '🔴';
            const moveRelay = this.shadowRoot.getElementById(`move_relay_${groupIdx}`);
            if (moveRelay) {
                const duration = groupTotal > 5 ? Math.max(1, 10 - (groupTotal / 200)) : 0;
                moveRelay.style.animationDuration = `${duration}s`;
                moveRelay.style.visibility = (relayState === 'on' && groupTotal > 5) ? 'visible' : 'hidden';
            }
        });
        const grid = parseFloat(this._hass.states[this.config.grid?.entity]?.state) || 0;
        const home = Math.max(0, solarTotal + grid);

        this.updateEntity('zon', solarTotal || 0, 5000);
        this.updateEntity('huis', home || 0, 5000);
        this.updateEntity('net', grid || 0, 5000);

        const moveNet = this.shadowRoot.getElementById('move_net');
        if (moveNet) {
            // Als grid > 0 (import), moet hij TEGEN de richting van het pad in (Net -> Huis)
            // Als grid < 0 (export), moet hij MET de richting van het pad mee (Huis -> Net)
            if (grid > 0)
                moveNet.classList.add('reverse');
            else
                moveNet.classList.remove('reverse');

            moveNet.style.visibility = Math.abs(grid) > 5 ? 'visible' : 'hidden';
        }
        const moveZon = this.shadowRoot.getElementById('move_zon');
        if (moveZon)
            moveZon.style.visibility = solarTotal > 5 ? 'visible' : 'hidden';
        // Update Afnemers (Donuts + Animatie)
        (this.config.home?.devices ?? []).forEach((d, i) => {
            const val = parseFloat(this._hass.states[d.entity]?.state ?? 0);
            // We sturen 'isDevice = true' mee om de animatie om te draaien en te vertragen
            this.updateEntity(`dev_${i}`, val, 3200, true);
        });
    }

    updateEntity(id, val, max, isDevice = false) {
        const valEl = this.shadowRoot.getElementById(`val_${id}`);
        if (valEl) {
            // Toon de echte waarde (met min-teken indien negatief)
            valEl.textContent = `${Math.round(val)}W`;
        }

        const ringEl = this.shadowRoot.getElementById(`ring_${id}`);
        if (ringEl && max > 0) {
            const circumference = 113;
            // Gebruik Math.abs voor de ring, want de grafiek moet altijd positief vullen
            const offset = circumference - (Math.min(Math.abs(val), max) / max) * circumference;
            ringEl.style.strokeDashoffset = offset;
        }

        const moveEl = this.shadowRoot.getElementById(`move_${id}`);
        if (moveEl) {
            const absVal = Math.abs(val);
            let duration;
            if (isDevice) {
                // SNELHEID VOOR AFNEMERS (Rechterkant)
                // Max 4 seconden traag, minimaal 0.5 seconde razendsnel
                duration = absVal > 5 ? Math.max(0.5, 4 - (absVal / 500)) : 0;
                moveEl.classList.remove('reverse');
            } else {
                // SNELHEID VOOR PANELEN, ZON, NET & HUIS (Linkerkant)
                // Omdat deze paden korter zijn, zetten we de basis op 3 seconden
                // zodat ze weer lekker vlot doorlopen.
                duration = absVal > 5 ? Math.max(0.4, 3 - (absVal / 500)) : 0;
            }

            moveEl.style.animationDuration = `${duration}s`;
            moveEl.style.visibility = absVal > 5 ? 'visible' : 'hidden';
    }


    }

}
customElements.define("rs-power-card", RsPowerCard);
