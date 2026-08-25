// ============================================
// Componente Navbar (Integrado con Top Navbar)
// ============================================

export class Navbar {
  constructor(container) {
    this.container = container;
  }

  render() {
    this.container.innerHTML = '';
  }

  mount() {
    this.render();
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
