class CADApp {
    constructor() {
        this.canvas = document.getElementById('cad-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.coordinatesDiv = document.getElementById('coordinates');
        this.propertiesContent = document.getElementById('properties-content');
        this.imageInput = document.getElementById('image-input');
        this.gridSize = 20;
        this.majorGridInterval = 5;
        this.gridColor = '#e0e0e0';
        this.majorGridColor = '#c0c0c0';
        this.zoom = 1;
        this.minZoom = 0.1;
        this.maxZoom = 10;
        this.panX = 0;
        this.panY = 0;
        this.currentTool = 'select';
        this.isDrawing = false;
        this.startPoint = null;
        this.endPoint = null;
        this.tempObject = null;
        this.objects = this.loadProject();
        this.selectedObject = null;
        this.snapDistance = 10;
        this.hoverSnapPoint = null;
        this.isDragging = false;
        this.dragOffset = {x: 0, y: 0};
        this.defaultStrokeWidth = 2;
        this.defaultDoorLength = 90; // cm cinsinden, px olarak da kullanılabilir
        this.draggedHandle = null; // döndürme veya taşıma için
        this.imageGallery = this.loadImageGallery();
        this.isPanning = false;
        this.panStart = {x: 0, y: 0};
        this.spacePressed = false;
        this.activeResizeHandle = null;
        this.initProjectIO();
        this.initEvents();
        this.draw();
    }
    initEvents() {
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (this.spacePressed && e.button === 0)) {
                this.isPanning = true;
                this.panStart = {x: e.clientX, y: e.clientY, panX: this.panX, panY: this.panY};
                this.canvas.style.cursor = 'grabbing';
                e.preventDefault();
                return;
            }
            this.handleMouseDown(e);
        });
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                const dx = e.clientX - this.panStart.x;
                const dy = e.clientY - this.panStart.y;
                this.panX = this.panStart.panX + dx;
                this.panY = this.panStart.panY + dy;
                this.draw();
                return;
            }
            this.handleMouseMove(e);
        });
        this.canvas.addEventListener('mouseup', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                this.canvas.style.cursor = '';
                return;
            }
            this.handleMouseUp(e);
        });
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        document.getElementById('select-tool').addEventListener('click', () => this.setTool('select'));
        document.getElementById('line-tool').addEventListener('click', () => this.setTool('line'));
        document.getElementById('rectangle-tool').addEventListener('click', () => this.setTool('rectangle'));
        document.getElementById('square-tool').addEventListener('click', () => this.setTool('square'));
        document.getElementById('dimension-tool').addEventListener('click', () => this.setTool('dimension'));
        document.getElementById('image-tool').addEventListener('click', () => this.openImageGallery());
        document.getElementById('delete-btn').addEventListener('click', () => this.deleteSelected());
        document.getElementById('door-tool').addEventListener('click', () => this.setTool('door'));
        document.getElementById('text-tool').addEventListener('click', () => this.setTool('text'));
        this.imageInput.addEventListener('change', this.handleImageUpload.bind(this));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        const defaultStrokeInput = document.getElementById('default-stroke-width');
        if (defaultStrokeInput) {
            defaultStrokeInput.addEventListener('change', (e) => {
                const val = parseInt(e.target.value);
                if (val >= 1 && val <= 12) this.defaultStrokeWidth = val;
            });
        }
        // Space tuşu ile pan
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                this.spacePressed = true;
                this.canvas.style.cursor = 'grab';
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.spacePressed = false;
                if (!this.isPanning) this.canvas.style.cursor = '';
            }
        });
    }
    initProjectIO() {
        // Kaydet
        document.getElementById('save-project-btn').onclick = () => {
            const data = this.serializeProject();
            const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'mimarcad-proje.json';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        };
        // Aç
        document.getElementById('load-project-btn').onclick = () => {
            document.getElementById('load-project-input').click();
        };
        document.getElementById('load-project-input').onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    this.deserializeProject(data);
                    this.draw();
                } catch {
                    alert('Geçersiz proje dosyası!');
                }
            };
            reader.readAsText(file);
        };
    }
    serializeProject() {
        // Resim nesneleri için sadece src kaydet
        return this.objects.map(obj => {
            if (obj.type === 'image' && obj.image) {
                return {...obj, imageSrc: obj.image.src, image: undefined};
            }
            return obj;
        });
    }
    deserializeProject(data) {
        this.objects = (data || []).map(obj => {
            if (obj.type === 'image' && obj.imageSrc) {
                const img = new window.Image();
                img.src = obj.imageSrc;
                return {...obj, image: img};
            }
            return obj;
        });
        this.selectedObject = null;
        this.updatePropertiesPanel();
    }
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const btn = document.getElementById(`${tool}-tool`);
        if (btn) btn.classList.add('active');
        this.clearSelection();
        this.draw();
    }
    handleMouseDown(e) {
        const {x, y, worldPos} = this.getMouseWorld(e);
        if (e.button !== 0) return;
        if (this.currentTool === 'select') {
            if (this.selectedObject && this.selectedObject.type === 'image') {
                const handles = this.getImageHandles(this.selectedObject);
                for (const h of handles) {
                    if (Math.abs(worldPos.x - h.x) < 10 / this.zoom && Math.abs(worldPos.y - h.y) < 10 / this.zoom) {
                        this.draggedHandle = h.pos;
                        this.activeResizeHandle = h.pos;
                        this.dragOffset = {
                            x: worldPos.x,
                            y: worldPos.y,
                            startX: this.selectedObject.x,
                            startY: this.selectedObject.y,
                            startW: this.selectedObject.width,
                            startH: this.selectedObject.height
                        };
                        return;
                    }
                }
            }
            if (this.selectedObject && this.selectedObject.type === 'text') {
                const handles = this.getTextHandles(this.selectedObject);
                for (const h of handles) {
                    if (Math.abs(worldPos.x - h.x) < 10 / this.zoom && Math.abs(worldPos.y - h.y) < 10 / this.zoom) {
                        this.draggedHandle = h.pos;
                        this.dragOffset = {
                            x: worldPos.x,
                            y: worldPos.y,
                            startX: this.selectedObject.x,
                            startY: this.selectedObject.y,
                            startFontSize: this.selectedObject.fontSize
                        };
                        return;
                    }
                }
            }
            let obj = this.getObjectAt(worldPos);
            if (obj && this.selectedObject === obj) {
                // Aynı nesneye tekrar tıklandıysa bir altındaki nesneyi seç
                obj = this.getObjectAt(worldPos, obj);
            }
            if (obj) {
                this.selectedObject = obj;
                this.isDragging = true;
                this.dragOffset = {x: worldPos.x, y: worldPos.y};
                if (obj.type === 'door' && obj._handle === 'end') {
                    this.draggedHandle = 'resize';
                    this.resizeOrigin = {x: obj.x, y: obj.y};
                    this.resizeStart = {x: worldPos.x, y: worldPos.y, length: obj.length};
                } else if (obj.type === 'door' && obj._handle === 'start') {
                    this.draggedHandle = 'moveStart';
                    this.resizeOrigin = {x: obj.x, y: obj.y};
                    this.resizeStart = {x: worldPos.x, y: worldPos.y, x: obj.x, y: obj.y, length: obj.length};
                } else if (obj.type === 'door' && obj._handle === 'move') {
                    this.draggedHandle = 'move';
                } else if (obj.type === 'image' && obj._resizeHandle) {
                    this.draggedHandle = obj._resizeHandle;
                    this.activeResizeHandle = obj._resizeHandle;
                    this.dragOffset = {
                        x: worldPos.x,
                        y: worldPos.y,
                        startX: obj.x,
                        startY: obj.y,
                        startW: obj.width,
                        startH: obj.height
                    };
                } else if (obj.type === 'door') {
                    this.draggedHandle = null;
                }
                this.updatePropertiesPanel();
            } else {
                this.clearSelection();
            }
        } else {
            this.isDrawing = true;
            const snap = this.findSnapPoint(worldPos.x, worldPos.y);
            this.startPoint = snap ? {...snap} : worldPos;
            this.endPoint = this.startPoint;
            
            // Metin aracı için özel işlem
            if (this.currentTool === 'text') {
                this.createTextObject(worldPos);
                this.isDrawing = false;
            }
        }
        this.draw();
    }
    handleMouseMove(e) {
        const {x, y, worldPos} = this.getMouseWorld(e);
        this.coordinatesDiv.textContent = `X: ${worldPos.x.toFixed(1)}, Y: ${worldPos.y.toFixed(1)}`;
        this.hoverSnapPoint = this.findSnapPoint(worldPos.x, worldPos.y);
        if (this.selectedObject && this.selectedObject.type === 'text' && this.draggedHandle) {
            const obj = this.selectedObject;
            const start = this.dragOffset;
            const dx = worldPos.x - start.x;
            const dy = worldPos.y - start.y;
            if (this.draggedHandle === 'se' || this.draggedHandle === 'ne') {
                // Sağ-alt veya sağ-üstten çekiliyorsa font boyutunu değiştir
                let newFontSize = Math.max(8, start.startFontSize + dy);
                obj.fontSize = newFontSize;
            }
            this.updatePropertiesPanel();
            this.draw();
            return;
        }
        if (this.selectedObject && this.selectedObject.type === 'image' && this.activeResizeHandle) {
            const obj = this.selectedObject;
            const start = this.dragOffset;
            let x = start.startX, y = start.startY, width = start.startW, height = start.startH;
            const dx = worldPos.x - start.x;
            const dy = worldPos.y - start.y;
            switch (this.activeResizeHandle) {
                case 'nw':
                    x = start.startX + dx;
                    y = start.startY + dy;
                    width = start.startW - dx;
                    height = start.startH - dy;
                    break;
                case 'n':
                    y = start.startY + dy;
                    height = start.startH - dy;
                    break;
                case 'ne':
                    y = start.startY + dy;
                    width = start.startW + dx;
                    height = start.startH - dy;
                    break;
                case 'e':
                    width = start.startW + dx;
                    break;
                case 'se':
                    width = start.startW + dx;
                    height = start.startH + dy;
                    break;
                case 's':
                    height = start.startH + dy;
                    break;
                case 'sw':
                    x = start.startX + dx;
                    width = start.startW - dx;
                    height = start.startH + dy;
                    break;
                case 'w':
                    x = start.startX + dx;
                    width = start.startW - dx;
                    break;
            }
            width = Math.max(10, width); height = Math.max(10, height);
            obj.x = x; obj.y = y; obj.width = width; obj.height = height;
            this.updatePropertiesPanel();
            this.draw();
            return;
        }
        if (this.isDrawing) {
            const snap = this.findSnapPoint(worldPos.x, worldPos.y);
            this.endPoint = snap ? {...snap} : worldPos;
        } else if (this.isDragging && this.selectedObject) {
            if (this.selectedObject.type === 'door' && this.draggedHandle === 'resize') {
                // Kapı uzunluğunu değiştir
                const dx = worldPos.x - this.selectedObject.x;
                const dy = worldPos.y - this.selectedObject.y;
                this.selectedObject.length = Math.sqrt(dx*dx + dy*dy);
                this.selectedObject.angle = Math.atan2(dy, dx);
                this.updatePropertiesPanel();
            } else if (this.selectedObject.type === 'door' && this.draggedHandle === 'moveStart') {
                // Kapının başlangıcını taşı
                const dx = worldPos.x - this.resizeStart.x;
                const dy = worldPos.y - this.resizeStart.y;
                this.selectedObject.x = this.resizeStart.x + dx;
                this.selectedObject.y = this.resizeStart.y + dy;
                this.selectedObject.length = this.resizeStart.length - Math.sqrt(dx*dx + dy*dy);
                this.updatePropertiesPanel();
            } else if (this.draggedHandle === 'rotate' && this.selectedObject.type === 'door') {
                const mouseAngle = Math.atan2(worldPos.y - this.selectedObject.x, worldPos.x - this.selectedObject.y);
                const startAngle = this.rotateStartMouse;
                this.selectedObject.angle = Math.atan2(worldPos.y - this.rotateOrigin.y, worldPos.x - this.rotateOrigin.x);
            } else if (this.draggedHandle === 'rotate' && this.selectedObject.type === 'image') {
                const mouseAngle = Math.atan2(worldPos.y - this.rotateOrigin.y, worldPos.x - this.rotateOrigin.x);
                this.selectedObject.rotation = this.rotateStartAngle + (mouseAngle - this.rotateStartMouse);
            } else if (this.selectedObject.type === 'door' && this.draggedHandle === 'move') {
                // Kapı gövdesini taşı
                this.selectedObject.x += worldPos.x - this.dragOffset.x;
                this.selectedObject.y += worldPos.y - this.dragOffset.y;
                this.dragOffset = {x: worldPos.x, y: worldPos.y};
                this.updatePropertiesPanel();
            } else if (this.selectedObject.type === 'image' && this.activeResizeHandle) {
                const obj = this.selectedObject;
                const start = this.dragOffset;
                let x = start.startX, y = start.startY, width = start.startW, height = start.startH;
                const dx = worldPos.x - start.x;
                const dy = worldPos.y - start.y;
                switch (this.activeResizeHandle) {
                    case 'nw':
                        x = start.startX + dx;
                        y = start.startY + dy;
                        width = start.startW - dx;
                        height = start.startH - dy;
                        break;
                    case 'n':
                        y = start.startY + dy;
                        height = start.startH - dy;
                        break;
                    case 'ne':
                        y = start.startY + dy;
                        width = start.startW + dx;
                        height = start.startH - dy;
                        break;
                    case 'e':
                        width = start.startW + dx;
                        break;
                    case 'se':
                        width = start.startW + dx;
                        height = start.startH + dy;
                        break;
                    case 's':
                        height = start.startH + dy;
                        break;
                    case 'sw':
                        x = start.startX + dx;
                        width = start.startW - dx;
                        height = start.startH + dy;
                        break;
                    case 'w':
                        x = start.startX + dx;
                        width = start.startW - dx;
                        break;
                }
                width = Math.max(10, width); height = Math.max(10, height);
                obj.x = x; obj.y = y; obj.width = width; obj.height = height;
                this.updatePropertiesPanel();
            } else {
                const dx = worldPos.x - this.dragOffset.x;
                const dy = worldPos.y - this.dragOffset.y;
                this.moveObject(this.selectedObject, dx, dy);
                this.dragOffset = {x: worldPos.x, y: worldPos.y};
                this.updatePropertiesPanel();
            }
        }
        this.draw();
    }
    handleMouseUp(e) {
        if (this.selectedObject && this.selectedObject.type === 'text' && this.draggedHandle) {
            this.draggedHandle = null;
            this.dragOffset = null;
            return;
        }
        let newObj = null;
        if (this.isDrawing && this.startPoint && this.endPoint) {
            switch (this.currentTool) {
                case 'line':
                    newObj = {type: 'line', start: {...this.startPoint}, end: {...this.endPoint}, strokeWidth: this.defaultStrokeWidth}; break;
                case 'rectangle':
                    newObj = this.createRectangle(this.startPoint, this.endPoint, this.defaultStrokeWidth); break;
                case 'square':
                    newObj = this.createSquare(this.startPoint, this.endPoint, this.defaultStrokeWidth); break;
                case 'dimension':
                    newObj = this.createDimension(this.startPoint, this.endPoint, this.defaultStrokeWidth); break;
                case 'door':
                    newObj = this.createDoor(this.startPoint, this.endPoint); break;
            }
            if (newObj) {
                this.objects.push(newObj);
                this.selectedObject = newObj;
                this.updatePropertiesPanel();
            }
        }
        this.isDrawing = false;
        this.startPoint = null;
        this.endPoint = null;
        this.tempObject = null;
        this.isDragging = false;
        this.draggedHandle = null;
        this.activeResizeHandle = null;
        if (this.selectedObject && this.selectedObject._resizeHandle) delete this.selectedObject._resizeHandle;
        this.draw();
    }
    handleWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        const worldX = (mouseX - this.panX) / this.zoom;
        const worldY = (mouseY - this.panY) / this.zoom;
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));
        if (newZoom !== this.zoom) {
            this.panX = mouseX - worldX * newZoom;
            this.panY = mouseY - worldY * newZoom;
            this.zoom = newZoom;
            this.draw();
        }
    }
    handleKeyDown(e) {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
        switch (e.key.toLowerCase()) {
            case 'v': this.setTool('select'); break;
            case 'l': this.setTool('line'); break;
            case 'r': this.setTool('rectangle'); break;
            case 's': this.setTool('square'); break;
            case 'd': this.setTool('dimension'); break;
            case 'i': this.imageInput.click(); break;
            case 'k': this.setTool('door'); break;
            case 't': this.setTool('text'); break;
            case 'delete': case 'backspace': this.deleteSelected(); break;
        }
    }
    getMouseWorld(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        const worldPos = this.screenToWorld(x, y);
        return {x, y, worldPos};
    }
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.panX) / this.zoom,
            y: (screenY - this.panY) / this.zoom
        };
    }
    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.zoom + this.panX,
            y: worldY * this.zoom + this.panY
        };
    }
    findSnapPoint(worldX, worldY) {
        // Grid snap
        const gridSnap = {
            x: Math.round(worldX / this.gridSize) * this.gridSize,
            y: Math.round(worldY / this.gridSize) * this.gridSize
        };
        const distGrid = Math.hypot(worldX - gridSnap.x, worldY - gridSnap.y);
        if (distGrid < this.snapDistance / this.zoom) return gridSnap;
        // Line endpoints snap
        for (const obj of this.objects) {
            if (obj.type === 'line' || obj.type === 'dimension') {
                for (const pt of [obj.start, obj.end]) {
                    const dist = Math.hypot(worldX - pt.x, worldY - pt.y);
                    if (dist < this.snapDistance / this.zoom) return pt;
                }
            } else if (obj.type === 'rectangle') {
                for (const pt of [
                    {x: obj.x, y: obj.y},
                    {x: obj.x + obj.width, y: obj.y},
                    {x: obj.x, y: obj.y + obj.height},
                    {x: obj.x + obj.width, y: obj.y + obj.height}
                ]) {
                    const dist = Math.hypot(worldX - pt.x, worldY - pt.y);
                    if (dist < this.snapDistance / this.zoom) return pt;
                }
            } else if (obj.type === 'square') {
                for (const pt of [
                    {x: obj.x, y: obj.y},
                    {x: obj.x + obj.size, y: obj.y},
                    {x: obj.x, y: obj.y + obj.size},
                    {x: obj.x + obj.size, y: obj.y + obj.size}
                ]) {
                    const dist = Math.hypot(worldX - pt.x, worldY - pt.y);
                    if (dist < this.snapDistance / this.zoom) return pt;
                }
            }
        }
        return null;
    }
    getObjectAt(worldPos, skipObject = null) {
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            if (skipObject && obj === skipObject) continue;
            if (obj.type === 'door') {
                const x2 = obj.x + Math.cos(obj.angle) * obj.length;
                const y2 = obj.y + Math.sin(obj.angle) * obj.length;
                const dist = this.pointToSegmentDist(worldPos, {x: obj.x, y: obj.y}, {x: x2, y: y2});
                if (dist < 10 / this.zoom) { obj._handle = 'move'; return obj; }
                if (Math.hypot(worldPos.x - obj.x, worldPos.y - obj.y) < 14 / this.zoom) { obj._handle = 'start'; return obj; }
                if (Math.hypot(worldPos.x - x2, worldPos.y - y2) < 14 / this.zoom) { obj._handle = 'end'; return obj; }
            } else if (obj.type === 'image') {
                // Handle'lar için öncelik
                const handles = this.getImageHandles(obj);
                for (const h of handles) {
                    if (Math.abs(worldPos.x - h.x) < 10 / this.zoom && Math.abs(worldPos.y - h.y) < 10 / this.zoom) {
                        obj._resizeHandle = h.pos;
                        return obj;
                    }
                }
                if (this.isPointInObject(worldPos, obj)) return obj;
            } else if (obj.type === 'text') {
                if (this.isPointInObject(worldPos, obj)) return obj;
            } else if (this.isPointInObject(worldPos, obj)) {
                return obj;
            }
        }
        return null;
    }
    isPointInObject(point, obj) {
        const tol = 7 / this.zoom;
        switch (obj.type) {
            case 'line':
            case 'dimension':
                if (this.isPointNearLine(point, obj, tol)) return true;
                const dx = obj.end.x - obj.start.x;
                const dy = obj.end.y - obj.start.y;
                const len = Math.sqrt(dx*dx + dy*dy);
                const offset = 18;
                const midX = (obj.start.x + obj.end.x) / 2;
                const midY = (obj.start.y + obj.end.y) / 2;
                const nx = -dy / len;
                const ny = dx / len;
                const labelX = midX + nx * offset;
                const labelY = midY + ny * offset;
                if (Math.abs(point.x - labelX) < 20/this.zoom && Math.abs(point.y - labelY) < 12/this.zoom) return true;
                return false;
            case 'rectangle':
                return point.x >= obj.x - tol && point.x <= obj.x + obj.width + tol && point.y >= obj.y - tol && point.y <= obj.y + obj.height + tol;
            case 'square':
                return point.x >= obj.x - tol && point.x <= obj.x + obj.size + tol && point.y >= obj.y - tol && point.y <= obj.y + obj.size + tol;
            case 'image':
                return point.x >= obj.x && point.x <= obj.x + obj.width && point.y >= obj.y && point.y <= obj.y + obj.height;
            case 'text':
                // Metin için yaklaşık sınır kutusu hesapla
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.font = `${obj.fontSize}px ${obj.fontFamily}`;
                const metrics = tempCtx.measureText(obj.text);
                const padding = 5 / this.zoom;
                return point.x >= obj.x - padding && 
                       point.x <= obj.x + metrics.width + padding && 
                       point.y >= obj.y - obj.fontSize - padding && 
                       point.y <= obj.y + padding;
        }
        return false;
    }
    isPointNearLine(point, obj, tol) {
        const A = point.x - obj.start.x;
        const B = point.y - obj.start.y;
        const C = obj.end.x - obj.start.x;
        const D = obj.end.y - obj.start.y;
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        if (lenSq === 0) return false;
        const param = dot / lenSq;
        let xx, yy;
        if (param < 0) { xx = obj.start.x; yy = obj.start.y; }
        else if (param > 1) { xx = obj.end.x; yy = obj.end.y; }
        else { xx = obj.start.x + param * C; yy = obj.start.y + param * D; }
        const dx = point.x - xx, dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy) <= tol;
    }
    moveObject(obj, dx, dy) {
        if (obj._dragEdge) {
            const snapDist = this.snapDistance / this.zoom;
            if (obj._dragEdge === 'left' && Math.abs(obj.x + dx - obj._dragEdgeOrig) < snapDist) {
                obj.x = obj._dragEdgeOrig;
            } else if (obj._dragEdge === 'right' && Math.abs(obj.x + obj.width + dx - obj._dragEdgeOrig) < snapDist) {
                obj.width = obj._dragEdgeOrig - obj.x;
            } else if (obj._dragEdge === 'top' && Math.abs(obj.y + dy - obj._dragEdgeOrig) < snapDist) {
                obj.y = obj._dragEdgeOrig;
            } else if (obj._dragEdge === 'bottom' && Math.abs(obj.y + obj.height + dy - obj._dragEdgeOrig) < snapDist) {
                obj.height = obj._dragEdgeOrig - obj.y;
            } else {
                if (obj._dragEdge === 'left') obj.x += dx;
                if (obj._dragEdge === 'right') obj.width += dx;
                if (obj._dragEdge === 'top') obj.y += dy;
                if (obj._dragEdge === 'bottom') obj.height += dy;
            }
            return;
        }
        switch (obj.type) {
            case 'line':
            case 'dimension':
                obj.start.x += dx; obj.start.y += dy;
                obj.end.x += dx; obj.end.y += dy;
                break;
            case 'rectangle':
                obj.x += dx; obj.y += dy;
                break;
            case 'square':
                obj.x += dx; obj.y += dy;
                break;
            case 'image':
                obj.x += dx; obj.y += dy;
                break;
            case 'door':
                obj.x += dx; obj.y += dy;
                break;
            case 'text':
                obj.x += dx; obj.y += dy;
                break;
        }
    }
    deleteSelected() {
        if (this.selectedObject) {
            const idx = this.objects.indexOf(this.selectedObject);
            if (idx > -1) this.objects.splice(idx, 1);
            this.selectedObject = null;
            this.updatePropertiesPanel();
            this.draw();
        }
    }
    clearSelection() {
        this.selectedObject = null;
        this.updatePropertiesPanel();
    }
    createRectangle(start, end, strokeWidth) {
        return {
            type: 'rectangle',
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            width: Math.abs(end.x - start.x),
            height: Math.abs(end.y - start.y),
            strokeWidth: strokeWidth || this.defaultStrokeWidth
        };
    }
    createSquare(start, end, strokeWidth) {
        const size = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
        return {
            type: 'square',
            x: start.x,
            y: start.y,
            size,
            strokeWidth: strokeWidth || this.defaultStrokeWidth
        };
    }
    createDimension(start, end, strokeWidth) {
        const distance = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
        return {
            type: 'dimension',
            start: {...start},
            end: {...end},
            distance,
            strokeWidth: strokeWidth || this.defaultStrokeWidth
        };
    }
    createDoor(start, end) {
        // Kapı çizgisi ve yay (açılış yönü: saat yönü)
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx*dx + dy*dy) || this.defaultDoorLength;
        const angle = Math.atan2(dy, dx);
        return {
            type: 'door',
            x: start.x,
            y: start.y,
            length: length,
            angle: angle,
            swing: 90, // derece, yay açısı
            strokeWidth: this.defaultStrokeWidth
        };
    }
    createTextObject(position) {
        const text = prompt('Metin girin:');
        if (!text) return;
        
        const textObj = {
            type: 'text',
            x: position.x,
            y: position.y,
            text: text,
            fontSize: 16,
            fontFamily: 'Arial',
            color: '#000000',
            rotation: 0
        };
        
        this.objects.push(textObj);
        this.selectedObject = textObj;
        this.updatePropertiesPanel();
        this.draw();
    }
    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const obj = {
                    type: 'image',
                    image: img,
                    x: 100, y: 100,
                    width: img.width, height: img.height,
                    rotation: 0
                };
                this.objects.push(obj);
                this.saveImageToGallery(event.target.result);
                this.selectedObject = obj;
                this.updatePropertiesPanel();
                this.draw();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
    saveImageToGallery(dataUrl) {
        if (!this.imageGallery.includes(dataUrl)) {
            this.imageGallery.push(dataUrl);
            localStorage.setItem('mimarcad_images', JSON.stringify(this.imageGallery));
        }
    }
    loadImageGallery() {
        try {
            return JSON.parse(localStorage.getItem('mimarcad_images')) || [];
        } catch { return []; }
    }
    updatePropertiesPanel() {
        if (!this.selectedObject) {
            this.propertiesContent.innerHTML = '<p>Bir nesne seçin</p>';
            return;
        }
        const obj = this.selectedObject;
        let html = '';
        if (obj.type === 'line' || obj.type === 'dimension') {
            const dx = obj.end.x - obj.start.x;
            const dy = obj.end.y - obj.start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            html += `
                <div class="property-group">
                    <label>Başlangıç X:</label>
                    <input type="number" id="start-x" value="${obj.start.x.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Başlangıç Y:</label>
                    <input type="number" id="start-y" value="${obj.start.y.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Bitiş X:</label>
                    <input type="number" id="end-x" value="${obj.end.x.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Bitiş Y:</label>
                    <input type="number" id="end-y" value="${obj.end.y.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Uzunluk:</label>
                    <input type="number" id="line-length" value="${length.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Kalınlık:</label>
                    <input type="number" id="stroke-width" min="1" max="12" value="${obj.strokeWidth || this.defaultStrokeWidth}">
                </div>
            `;
        } else if (obj.type === 'rectangle') {
            html += `
                <div class="property-group">
                    <label>X:</label>
                    <input type="number" id="x" value="${obj.x.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Y:</label>
                    <input type="number" id="y" value="${obj.y.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Genişlik:</label>
                    <input type="number" id="width" value="${obj.width.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Yükseklik:</label>
                    <input type="number" id="height" value="${obj.height.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Kalınlık:</label>
                    <input type="number" id="stroke-width" min="1" max="12" value="${obj.strokeWidth || this.defaultStrokeWidth}">
                </div>
            `;
        } else if (obj.type === 'square') {
            html += `
                <div class="property-group">
                    <label>X:</label>
                    <input type="number" id="x" value="${obj.x.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Y:</label>
                    <input type="number" id="y" value="${obj.y.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Boyut:</label>
                    <input type="number" id="size" value="${obj.size.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Kalınlık:</label>
                    <input type="number" id="stroke-width" min="1" max="12" value="${obj.strokeWidth || this.defaultStrokeWidth}">
                </div>
            `;
        } else if (obj.type === 'image') {
            html += `
                <div class="property-group">
                    <label>X:</label>
                    <input type="number" id="x" value="${obj.x.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Y:</label>
                    <input type="number" id="y" value="${obj.y.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Genişlik:</label>
                    <input type="number" id="width" value="${obj.width.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Yükseklik:</label>
                    <input type="number" id="height" value="${obj.height.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Açı (derece):</label>
                    <input type="number" id="rotation" value="${((obj.rotation||0)*180/Math.PI).toFixed(1)}">
                </div>
            `;
        } else if (obj.type === 'door') {
            html += `
                <div class="property-group">
                    <label>X:</label>
                    <input type="number" id="door-x" value="${obj.x.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Y:</label>
                    <input type="number" id="door-y" value="${obj.y.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Uzunluk:</label>
                    <input type="number" id="door-length" value="${obj.length.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Açı (derece):</label>
                    <input type="number" id="door-angle" value="${(obj.angle * 180 / Math.PI).toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Açılış (derece):</label>
                    <input type="number" id="door-swing" value="${obj.swing}">
                </div>
                <div class="property-group">
                    <label>Kalınlık:</label>
                    <input type="number" id="stroke-width" min="1" max="12" value="${obj.strokeWidth || this.defaultStrokeWidth}">
                </div>
            `;
        } else if (obj.type === 'text') {
            html += `
                <div class="property-group">
                    <label>X:</label>
                    <input type="number" id="text-x" value="${obj.x.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Y:</label>
                    <input type="number" id="text-y" value="${obj.y.toFixed(1)}">
                </div>
                <div class="property-group">
                    <label>Metin:</label>
                    <input type="text" id="text-content" value="${obj.text}">
                </div>
                <div class="property-group">
                    <label>Font Boyutu:</label>
                    <input type="number" id="text-font-size" min="8" max="72" value="${obj.fontSize}">
                </div>
                <div class="property-group">
                    <label>Font:</label>
                    <select id="text-font-family">
                        <option value="Arial" ${obj.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                        <option value="Times New Roman" ${obj.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                        <option value="Courier New" ${obj.fontFamily === 'Courier New' ? 'selected' : ''}>Courier New</option>
                        <option value="Verdana" ${obj.fontFamily === 'Verdana' ? 'selected' : ''}>Verdana</option>
                    </select>
                </div>
                <div class="property-group">
                    <label>Renk:</label>
                    <input type="color" id="text-color" value="${obj.color}">
                </div>
                <div class="property-group">
                    <label>Açı (derece):</label>
                    <input type="number" id="text-rotation" value="${((obj.rotation||0)*180/Math.PI).toFixed(1)}">
                </div>
            `;
        }
        this.propertiesContent.innerHTML = html;
        this.attachPropertyListeners();
    }
    attachPropertyListeners() {
        const obj = this.selectedObject;
        if (!obj) return;
        const inputs = this.propertiesContent.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const val = parseFloat(e.target.value);
                switch (e.target.id) {
                    case 'start-x': obj.start.x = val; break;
                    case 'start-y': obj.start.y = val; break;
                    case 'end-x': obj.end.x = val; break;
                    case 'end-y': obj.end.y = val; break;
                    case 'line-length': {
                        const dx = obj.end.x - obj.start.x;
                        const dy = obj.end.y - obj.start.y;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        if (len > 0) {
                            const scale = val / len;
                            obj.end.x = obj.start.x + dx * scale;
                            obj.end.y = obj.start.y + dy * scale;
                        }
                        break;
                    }
                    case 'x': obj.x = val; break;
                    case 'y': obj.y = val; break;
                    case 'width': obj.width = val; break;
                    case 'height': obj.height = val; break;
                    case 'size': obj.size = val; break;
                    case 'stroke-width': obj.strokeWidth = val; break;
                    case 'door-x': obj.x = val; break;
                    case 'door-y': obj.y = val; break;
                    case 'door-length': obj.length = val; break;
                    case 'door-angle': obj.angle = val * Math.PI / 180; break;
                    case 'door-swing': obj.swing = val; break;
                    case 'rotation': obj.rotation = val * Math.PI / 180; break;
                    case 'text-x': obj.x = val; break;
                    case 'text-y': obj.y = val; break;
                    case 'text-content': obj.text = e.target.value; break;
                    case 'text-font-size': obj.fontSize = val; break;
                    case 'text-font-family': obj.fontFamily = e.target.value; break;
                    case 'text-color': obj.color = e.target.value; break;
                    case 'text-rotation': obj.rotation = val * Math.PI / 180; break;
                }
                this.draw();
            });
        });
        
        // Select elementleri için listener
        const selects = this.propertiesContent.querySelectorAll('select');
        selects.forEach(select => {
            select.addEventListener('change', (e) => {
                switch (e.target.id) {
                    case 'text-font-family': obj.fontFamily = e.target.value; break;
                }
                this.draw();
            });
        });
    }
    drawGrid() {
        const w = this.canvas.width, h = this.canvas.height;
        const worldStart = this.screenToWorld(0, 0);
        const worldEnd = this.screenToWorld(w, h);
        const startX = Math.floor(worldStart.x / this.gridSize) * this.gridSize;
        const endX = Math.ceil(worldEnd.x / this.gridSize) * this.gridSize;
        const startY = Math.floor(worldStart.y / this.gridSize) * this.gridSize;
        const endY = Math.ceil(worldEnd.y / this.gridSize) * this.gridSize;
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (let x = startX; x <= endX; x += this.gridSize) {
            const screenX = x * this.zoom + this.panX;
            const isMajor = x % (this.gridSize * this.majorGridInterval) === 0;
            this.ctx.strokeStyle = isMajor ? this.majorGridColor : this.gridColor;
            this.ctx.lineWidth = isMajor ? 2 : 1;
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, 0);
            this.ctx.lineTo(screenX, h);
            this.ctx.stroke();
        }
        for (let y = startY; y <= endY; y += this.gridSize) {
            const screenY = y * this.zoom + this.panY;
            const isMajor = y % (this.gridSize * this.majorGridInterval) === 0;
            this.ctx.strokeStyle = isMajor ? this.majorGridColor : this.gridColor;
            this.ctx.lineWidth = isMajor ? 2 : 1;
            this.ctx.beginPath();
            this.ctx.moveTo(0, screenY);
            this.ctx.lineTo(w, screenY);
            this.ctx.stroke();
        }
        this.ctx.restore();
    }
    drawGridLabels() {
        // HTML label'ları temizle
        document.querySelectorAll('.grid-label-x, .grid-label-y').forEach(el => el.remove());
        const w = this.canvas.width, h = this.canvas.height;
        const worldStart = this.screenToWorld(0, 0);
        const worldEnd = this.screenToWorld(w, h);
        const startX = Math.floor(worldStart.x / this.gridSize) * this.gridSize;
        const endX = Math.ceil(worldEnd.x / this.gridSize) * this.gridSize;
        const startY = Math.floor(worldStart.y / this.gridSize) * this.gridSize;
        const endY = Math.ceil(worldEnd.y / this.gridSize) * this.gridSize;
        const toolbarWidth = 80; // toolbar genişliği (px)
        const topOffset = 24;    // üstten boşluk (px)
        // X ekseni (üstte)
        for (let x = startX; x <= endX; x += this.gridSize) {
            const screen = this.worldToScreen(x, 0);
            if (screen.x < toolbarWidth + 10 || screen.x > w - 20) continue;
            const label = document.createElement('div');
            label.className = 'grid-label-x';
            label.style.left = `${screen.x}px`;
            label.style.top = `${topOffset}px`;
            label.textContent = x;
            document.querySelector('.canvas-container').appendChild(label);
        }
        // Y ekseni (solda)
        for (let y = startY; y <= endY; y += this.gridSize) {
            const screen = this.worldToScreen(0, y);
            if (screen.y < topOffset + 10 || screen.y > h - 20) continue;
            const label = document.createElement('div');
            label.className = 'grid-label-y';
            label.style.top = `${screen.y}px`;
            label.style.left = `${toolbarWidth}px`;
            label.textContent = y;
            document.querySelector('.canvas-container').appendChild(label);
        }
    }
    draw() {
        this.saveProject();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();
        this.drawGridLabels();
        this.ctx.save();
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoom, this.zoom);
        for (const obj of this.objects) {
            if (obj.type === 'line') {
                this.ctx.strokeStyle = (obj === this.selectedObject) ? '#2980b9' : '#3498db';
                this.ctx.lineWidth = obj.strokeWidth || this.defaultStrokeWidth;
                this.ctx.beginPath();
                this.ctx.moveTo(obj.start.x, obj.start.y);
                this.ctx.lineTo(obj.end.x, obj.end.y);
                this.ctx.stroke();
            } else if (obj.type === 'rectangle') {
                this.ctx.strokeStyle = (obj === this.selectedObject) ? '#2980b9' : '#222';
                this.ctx.lineWidth = obj.strokeWidth || this.defaultStrokeWidth;
                this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
            } else if (obj.type === 'square') {
                this.ctx.strokeStyle = (obj === this.selectedObject) ? '#2980b9' : '#222';
                this.ctx.lineWidth = obj.strokeWidth || this.defaultStrokeWidth;
                this.ctx.strokeRect(obj.x, obj.y, obj.size, obj.size);
            } else if (obj.type === 'dimension') {
                this.ctx.strokeStyle = (obj === this.selectedObject) ? '#27ae60' : '#27ae60';
                this.ctx.lineWidth = (obj.strokeWidth || this.defaultStrokeWidth) + 2;
                this.ctx.beginPath();
                this.ctx.moveTo(obj.start.x, obj.start.y);
                this.ctx.lineTo(obj.end.x, obj.end.y);
                this.ctx.stroke();
                const dx = obj.end.x - obj.start.x;
                const dy = obj.end.y - obj.start.y;
                const len = Math.sqrt(dx*dx + dy*dy);
                const tx = -dy / len * 14;
                const ty = dx / len * 14;
                this.ctx.beginPath();
                this.ctx.moveTo(obj.start.x - tx, obj.start.y - ty);
                this.ctx.lineTo(obj.start.x + tx, obj.start.y + ty);
                this.ctx.moveTo(obj.end.x - tx, obj.end.y - ty);
                this.ctx.lineTo(obj.end.x + tx, obj.end.y + ty);
                this.ctx.strokeStyle = '#27ae60';
                this.ctx.lineWidth = (obj.strokeWidth || this.defaultStrokeWidth) + 2;
                this.ctx.stroke();
                const midX = (obj.start.x + obj.end.x) / 2;
                const midY = (obj.start.y + obj.end.y) / 2;
                const offset = 28;
                const nx = -dy / len;
                const ny = dx / len;
                const labelX = midX + nx * offset;
                const labelY = midY + ny * offset - 6;
                this.ctx.save();
                // Arka plan kutusu
                this.ctx.font = 'bold 18px Arial';
                const text = (obj.distance || len).toFixed(1);
                const metrics = this.ctx.measureText(text);
                this.ctx.fillStyle = 'white';
                this.ctx.globalAlpha = 0.85;
                this.ctx.fillRect(labelX - metrics.width/2 - 8, labelY - 16, metrics.width + 16, 28);
                this.ctx.globalAlpha = 1.0;
                // Yazı
                this.ctx.fillStyle = '#27ae60';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.font = 'bold 18px Arial';
                this.ctx.fillText(text, labelX, labelY);
                this.ctx.restore();
            } else if (obj.type === 'image' && obj.image) {
                this.ctx.save();
                const cx = obj.x + obj.width/2;
                const cy = obj.y + obj.height/2;
                this.ctx.translate(cx, cy);
                this.ctx.rotate(obj.rotation || 0);
                this.ctx.drawImage(obj.image, -obj.width/2, -obj.height/2, obj.width, obj.height);
                if (obj === this.selectedObject) {
                    this.ctx.strokeStyle = '#2980b9';
                    this.ctx.lineWidth = this.defaultStrokeWidth;
                    this.ctx.strokeRect(-obj.width/2, -obj.height/2, obj.width, obj.height);
                    // Döndürme noktası
                    this.ctx.beginPath();
                    this.ctx.arc(obj.width/2, -obj.height/2, 12, 0, 2*Math.PI);
                    this.ctx.fillStyle = '#e67e22';
                    this.ctx.fill();
                    // --- Handle noktaları ---
                    const handles = this.getImageHandles({x: -obj.width/2, y: -obj.height/2, width: obj.width, height: obj.height});
                    for (const h of handles) {
                        this.ctx.beginPath();
                        this.ctx.arc(h.x, h.y, 7, 0, 2*Math.PI);
                        this.ctx.fillStyle = '#fff';
                        this.ctx.fill();
                        this.ctx.beginPath();
                        this.ctx.arc(h.x, h.y, 5, 0, 2*Math.PI);
                        this.ctx.fillStyle = '#2980b9';
                        this.ctx.fill();
                    }
                }
                this.ctx.restore();
            } else if (obj.type === 'door') {
                this.ctx.save();
                // Seçili ise daha kalın ve parlak
                if (obj === this.selectedObject) {
                    this.ctx.shadowColor = '#e67e22';
                    this.ctx.shadowBlur = 12;
                    this.ctx.strokeStyle = '#e67e22';
                    this.ctx.lineWidth = (obj.strokeWidth || this.defaultStrokeWidth) + 2;
                } else {
                    this.ctx.strokeStyle = '#8e44ad';
                    this.ctx.lineWidth = obj.strokeWidth || this.defaultStrokeWidth;
                    this.ctx.shadowBlur = 0;
                }
                // Kapı çizgisi
                this.ctx.beginPath();
                this.ctx.moveTo(obj.x, obj.y);
                const x2 = obj.x + Math.cos(obj.angle) * obj.length;
                const y2 = obj.y + Math.sin(obj.angle) * obj.length;
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
                // Kapı yayını çiz
                this.ctx.beginPath();
                this.ctx.arc(obj.x, obj.y, obj.length, obj.angle, obj.angle + (obj.swing * Math.PI / 180), false);
                this.ctx.setLineDash([6, 6]);
                this.ctx.strokeStyle = '#e67e22';
                this.ctx.stroke();
                this.ctx.setLineDash([]);
                // Handle noktaları
                if (obj === this.selectedObject) {
                    this.ctx.shadowBlur = 0;
                    this.ctx.beginPath();
                    this.ctx.arc(obj.x, obj.y, 9, 0, 2*Math.PI);
                    this.ctx.arc(x2, y2, 9, 0, 2*Math.PI);
                    this.ctx.fillStyle = '#fff';
                    this.ctx.fill();
                    this.ctx.beginPath();
                    this.ctx.arc(obj.x, obj.y, 7, 0, 2*Math.PI);
                    this.ctx.arc(x2, y2, 7, 0, 2*Math.PI);
                    this.ctx.fillStyle = '#e67e22';
                    this.ctx.fill();
                }
                this.ctx.restore();
            } else if (obj.type === 'text') {
                this.ctx.save();
                this.ctx.translate(obj.x, obj.y);
                this.ctx.rotate(obj.rotation || 0);
                // Seçili ise arka plan kutusu çiz
                if (obj === this.selectedObject) {
                    this.ctx.font = `${obj.fontSize}px ${obj.fontFamily}`;
                    const metrics = this.ctx.measureText(obj.text);
                    const padding = 4;
                    // Kutu ve handle'lar metnin üstüne değil, çevresine gelsin
                    const boxX = 0 - padding;
                    const boxY = -obj.fontSize - padding;
                    const boxW = metrics.width + padding * 2;
                    const boxH = obj.fontSize + padding * 2;
                    this.ctx.fillStyle = 'rgba(41, 128, 185, 0.1)';
                    this.ctx.fillRect(boxX, boxY, boxW, boxH);
                    this.ctx.strokeStyle = '#2980b9';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(boxX, boxY, boxW, boxH);
                    // Handle'ları çiz
                    const handles = this.getTextHandles(obj, metrics, padding);
                    this.ctx.save();
                    this.ctx.rotate(-(obj.rotation || 0));
                    for (const h of handles) {
                        this.ctx.beginPath();
                        this.ctx.arc(h.x, h.y, 5 / this.zoom, 0, 2 * Math.PI);
                        this.ctx.fillStyle = '#fff';
                        this.ctx.fill();
                        this.ctx.strokeStyle = '#2980b9';
                        this.ctx.stroke();
                    }
                    this.ctx.restore();
                }
                // Metni çiz
                this.ctx.fillStyle = obj.color || '#000000';
                this.ctx.font = `${obj.fontSize}px ${obj.fontFamily}`;
                this.ctx.textAlign = 'left';
                this.ctx.textBaseline = 'top';
                this.ctx.fillText(obj.text, 0, 0);
                this.ctx.restore();
            }
        }
        if (this.isDrawing && this.startPoint && this.endPoint) {
            let preview = null;
            switch (this.currentTool) {
                case 'line':
                    preview = {type: 'line', start: this.startPoint, end: this.endPoint}; break;
                case 'rectangle':
                    preview = this.createRectangle(this.startPoint, this.endPoint, this.defaultStrokeWidth); break;
                case 'square':
                    preview = this.createSquare(this.startPoint, this.endPoint, this.defaultStrokeWidth); break;
                case 'dimension':
                    preview = this.createDimension(this.startPoint, this.endPoint, this.defaultStrokeWidth); break;
                case 'door':
                    preview = this.createDoor(this.startPoint, this.endPoint); break;
            }
            if (preview) {
                if (preview.type === 'line') {
                    this.ctx.strokeStyle = '#222';
                    this.ctx.lineWidth = this.defaultStrokeWidth;
                    this.ctx.beginPath();
                    this.ctx.moveTo(preview.start.x, preview.start.y);
                    this.ctx.lineTo(preview.end.x, preview.end.y);
                    this.ctx.stroke();
                } else if (preview.type === 'rectangle') {
                    this.ctx.strokeStyle = '#222';
                    this.ctx.lineWidth = this.defaultStrokeWidth;
                    this.ctx.strokeRect(preview.x, preview.y, preview.width, preview.height);
                } else if (preview.type === 'square') {
                    this.ctx.strokeStyle = '#222';
                    this.ctx.lineWidth = this.defaultStrokeWidth;
                    this.ctx.strokeRect(preview.x, preview.y, preview.size, preview.size);
                } else if (preview.type === 'dimension') {
                    this.ctx.strokeStyle = '#27ae60';
                    this.ctx.lineWidth = this.defaultStrokeWidth;
                    this.ctx.beginPath();
                    this.ctx.moveTo(preview.start.x, preview.start.y);
                    this.ctx.lineTo(preview.end.x, preview.end.y);
                    this.ctx.stroke();
                }
            }
        }
        this.ctx.restore();
        if (this.hoverSnapPoint) {
            const screen = this.worldToScreen(this.hoverSnapPoint.x, this.hoverSnapPoint.y);
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(screen.x, screen.y, 7, 0, 2 * Math.PI);
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.globalAlpha = 0.7;
            this.ctx.fill();
            this.ctx.restore();
        }
    }
    openImageGallery() {
        // Galeri modalı oluştur
        let modal = document.getElementById('image-gallery-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'image-gallery-modal';
            modal.style.position = 'fixed';
            modal.style.left = '0';
            modal.style.top = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.background = 'rgba(0,0,0,0.4)';
            modal.style.zIndex = '9999';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.innerHTML = `<div style="background:#fff;padding:24px 32px;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;">
                <h3 style="margin-top:0;">Resim Galerisi</h3>
                <div id="gallery-list" style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;"></div>
                <button id="gallery-upload-btn">Yeni Resim Yükle</button>
                <button id="gallery-close-btn" style="margin-left:16px;">Kapat</button>
            </div>`;
            document.body.appendChild(modal);
            document.getElementById('gallery-close-btn').onclick = () => modal.remove();
            document.getElementById('gallery-upload-btn').onclick = () => this.imageInput.click();
        }
        // Galeri doldur
        const galleryList = modal.querySelector('#gallery-list');
        galleryList.innerHTML = '';
        this.imageGallery.forEach((imgData, idx) => {
            const img = document.createElement('img');
            img.src = imgData;
            img.style.width = '80px';
            img.style.height = '80px';
            img.style.objectFit = 'contain';
            img.style.border = '2px solid #2980b9';
            img.style.borderRadius = '8px';
            img.style.cursor = 'pointer';
            img.title = 'Resmi ekle';
            img.onclick = () => {
                const imageObj = {
                    type: 'image',
                    image: new window.Image(),
                    x: 100, y: 100,
                    width: 80, height: 80,
                    rotation: 0
                };
                imageObj.image.onload = () => {
                    this.objects.push(imageObj);
                    this.selectedObject = imageObj;
                    this.updatePropertiesPanel();
                    this.draw();
                };
                imageObj.image.src = imgData;
                modal.remove();
            };
            galleryList.appendChild(img);
        });
        modal.style.display = 'flex';
    }
    saveProject() {
        // Resim nesneleri için image src'sini (dataURL) kaydet
        const serializable = this.objects.map(obj => {
            if (obj.type === 'image' && obj.image) {
                return {
                    ...obj,
                    imageSrc: obj.image.src
                };
            }
            return obj;
        });
        localStorage.setItem('mimarcad_project', JSON.stringify(serializable));
    }
    loadProject() {
        try {
            const arr = JSON.parse(localStorage.getItem('mimarcad_project')) || [];
            // Resim nesneleri için image nesnesini oluştur
            return arr.map(obj => {
                if (obj.type === 'image' && obj.imageSrc) {
                    const img = new window.Image();
                    img.src = obj.imageSrc;
                    return {...obj, image: img};
                }
                return obj;
            });
        } catch { return []; }
    }
    pointToSegmentDist(p, a, b) {
        const l2 = (a.x-b.x)**2 + (a.y-b.y)**2;
        if (l2 === 0) return Math.hypot(p.x-a.x, p.y-a.y);
        let t = ((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x-(a.x+t*(b.x-a.x)), p.y-(a.y+t*(b.y-a.y)));
    }
    getImageHandles(obj) {
        // 8 handle: 4 köşe, 4 kenar ortası
        const {x, y, width, height} = obj;
        return [
            {x: x, y: y, pos: 'nw'},
            {x: x + width/2, y: y, pos: 'n'},
            {x: x + width, y: y, pos: 'ne'},
            {x: x + width, y: y + height/2, pos: 'e'},
            {x: x + width, y: y + height, pos: 'se'},
            {x: x + width/2, y: y + height, pos: 's'},
            {x: x, y: y + height, pos: 'sw'},
            {x: x, y: y + height/2, pos: 'w'}
        ];
    }
    getTextHandles(obj, metrics = null, padding = 4) {
        // Kutuya göre handle'lar
        if (!metrics) {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.font = `${obj.fontSize}px ${obj.fontFamily}`;
            metrics = tempCtx.measureText(obj.text);
        }
        return [
            { x: metrics.width + padding, y: -obj.fontSize - padding, pos: 'ne' }, // sağ-üst
            { x: metrics.width + padding, y: padding, pos: 'se' }, // sağ-alt
            { x: -padding, y: -obj.fontSize - padding, pos: 'nw' }, // sol-üst
            { x: -padding, y: padding, pos: 'sw' }, // sol-alt
        ];
    }
}
document.addEventListener('DOMContentLoaded', () => {
    // Şifre kontrolü
    const modal = document.getElementById('password-modal');
    const input = document.getElementById('password-input');
    const btn = document.getElementById('password-submit');
    const error = document.getElementById('password-error');
    const cadContainer = document.querySelector('.cad-container');
    function checkPassword() {
        if (input.value === 'merve8387') {
            modal.style.display = 'none';
            cadContainer.style.display = '';
        } else {
            error.style.display = 'block';
        }
    }
    btn.onclick = checkPassword;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') checkPassword(); });
    input.focus();
    // CAD başlat
    new CADApp();

    // PDF olarak kaydetme
    const pdfBtn = document.getElementById('save-pdf-btn');
    if (pdfBtn) {
        pdfBtn.onclick = function() {
            const canvas = document.getElementById('cad-canvas');
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            // PDF boyutunu canvas boyutuna göre ayarla (mm cinsinden)
            const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? 'l' : 'p',
                unit: 'mm',
                format: [canvas.width * 0.264583, canvas.height * 0.264583]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width * 0.264583, canvas.height * 0.264583);
            pdf.save('mimarcad-cizim.pdf');
        };
    }
}); 