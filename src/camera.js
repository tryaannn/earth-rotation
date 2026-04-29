class OrbitCamera {
  constructor() {
    this.theta  = 0.3;         // horizontal angle (radians)
    this.phi    = 1.2;         // vertical angle   (radians)
    this.radius = 3.5;

    this.minPhi    = 0.15;
    this.maxPhi    = Math.PI - 0.15;
    this.minRadius = 1.5;
    this.maxRadius = 12.0;

    this._dragging   = false;
    this._lastX      = 0;
    this._lastY      = 0;

    this.position = [0, 0, 3.5];
  }

  attach(canvas) {
    canvas.addEventListener('mousedown',  e => this._onDown(e));
    canvas.addEventListener('mousemove',  e => this._onMove(e));
    canvas.addEventListener('mouseup',    ()  => this._dragging = false);
    canvas.addEventListener('mouseleave', ()  => this._dragging = false);
    canvas.addEventListener('wheel',      e => this._onWheel(e), { passive: true });

    // touch
    canvas.addEventListener('touchstart',  e => this._onTouchStart(e), { passive: true });
    canvas.addEventListener('touchmove',   e => this._onTouchMove(e),  { passive: false });
    canvas.addEventListener('touchend',    ()  => this._dragging = false);
  }

  _onDown(e) {
    this._dragging = true;
    this._lastX = e.clientX;
    this._lastY = e.clientY;
  }

  _onMove(e) {
    if (!this._dragging) return;
    const dx = e.clientX - this._lastX;
    const dy = e.clientY - this._lastY;
    this._lastX = e.clientX;
    this._lastY = e.clientY;
    this.theta -= dx * 0.005;
    this.phi   = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi + dy * 0.005));
  }

  _onWheel(e) {
    this.radius = Math.max(this.minRadius, Math.min(this.maxRadius, this.radius + e.deltaY * 0.005));
  }

  _onTouchStart(e) {
    if (e.touches.length === 1) {
      this._dragging = true;
      this._lastX = e.touches[0].clientX;
      this._lastY = e.touches[0].clientY;
    }
  }

  _onTouchMove(e) {
    if (!this._dragging || e.touches.length !== 1) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - this._lastX;
    const dy = e.touches[0].clientY - this._lastY;
    this._lastX = e.touches[0].clientX;
    this._lastY = e.touches[0].clientY;
    this.theta -= dx * 0.005;
    this.phi   = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi + dy * 0.005));
  }

  getPosition() {
    const sinPhi = Math.sin(this.phi);
    const cosPhi = Math.cos(this.phi);
    return [
      this.radius * sinPhi * Math.cos(this.theta),
      this.radius * cosPhi,
      this.radius * sinPhi * Math.sin(this.theta)
    ];
  }

  getViewMatrix(out) {
    const pos = this.getPosition();
    this.position = pos;
    return mat4.lookAt(out, pos, [0,0,0], [0,1,0]);
  }
}
