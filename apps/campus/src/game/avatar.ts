import Phaser from 'phaser';
import { AVATAR_RADIUS, hashHue } from './predict';

// Avatar tạm: hình tròn màu theo hash id + nhãn tên hiển thị. Không gì khác.
export class Avatar {
  readonly container: Phaser.GameObjects.Container;
  private label: Phaser.GameObjects.Text;
  private shown = '';

  constructor(scene: Phaser.Scene, id: string, name: string, x: number, y: number) {
    const color = Phaser.Display.Color.HSLToColor(hashHue(id) / 360, 0.65, 0.5).color;
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(0, 0, AVATAR_RADIUS);
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeCircle(0, 0, AVATAR_RADIUS);
    this.label = scene.add.text(0, -AVATAR_RADIUS - 6, name, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 1);
    this.shown = name;
    this.container = scene.add.container(x, y, [g, this.label]);
  }

  setName(name: string) {
    if (name !== this.shown) { this.shown = name; this.label.setText(name); }
  }
  setPos(x: number, y: number) { this.container.setPosition(x, y); }
  setDepth(d: number) { this.container.setDepth(d); }
  destroy() { this.container.destroy(true); }
}
