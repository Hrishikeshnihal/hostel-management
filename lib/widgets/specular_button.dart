import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';

class SpecularButton extends StatefulWidget {
  final Widget child;
  final VoidCallback? onPressed;
  final double radius;
  final Color tint;
  final double tintOpacity;
  final Color textColor;
  final Color lineColor;
  final Color baseColor;
  final double intensity;
  final double shineSize; // in degrees
  final double shineFade; // in degrees
  final double thickness;
  final double speed;
  final bool followMouse;
  final double proximity;
  final bool autoAnimate;
  final bool disabled;

  const SpecularButton({
    super.key,
    required this.child,
    this.onPressed,
    this.radius = 18.0,
    this.tint = Colors.white,
    this.tintOpacity = 0.0,
    this.textColor = const Color(0xFFF5F5F5),
    this.lineColor = Colors.white,
    this.baseColor = const Color(0xFF525252),
    this.intensity = 1.0,
    this.shineSize = 10.0,
    this.shineFade = 40.0,
    this.thickness = 1.5,
    this.speed = 0.35,
    this.followMouse = true,
    this.proximity = 250.0,
    this.autoAnimate = false,
    this.disabled = false,
  });

  @override
  State<SpecularButton> createState() => _SpecularButtonState();
}

class _SpecularButtonState extends State<SpecularButton> with SingleTickerProviderStateMixin {
  ui.FragmentShader? _shader;
  late AnimationController _rotationController;

  double _angle = 2.4;
  double _idleAngle = 2.4;
  double _proximityBrightness = 0.0;
  Offset _pointerPos = Offset.zero;

  @override
  void initState() {
    super.initState();
    _loadShader();

    _rotationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    )..addListener(() {
        if (mounted) {
          setState(() {
            _idleAngle += widget.speed * 0.016; // Tick angle sweep
            _updateSteerAngle();
          });
        }
      });

    _rotationController.repeat();
  }

  Future<void> _loadShader() async {
    try {
      final program = await ui.FragmentProgram.fromAsset('assets/shaders/specular.frag');
      setState(() {
        _shader = program.fragmentShader();
      });
    } catch (e) {
      debugPrint("Error loading specular shader: $e");
    }
  }

  void _updateSteerAngle() {
    final bool steer = widget.followMouse && _pointerPos != Offset.zero && (!widget.autoAnimate || _proximityBrightness > 0);
    final double target = steer ? _calculatePointerAngle() : _idleAngle;

    // Smoothly interpolate angle
    final diff = ((target - _angle + math.pi * 3) % (math.pi * 2)) - math.pi;
    _angle += diff * 0.12; // Easing factor
  }

  double _calculatePointerAngle() {
    final box = context.findRenderObject() as RenderBox?;
    if (box == null) return _idleAngle;

    final center = Offset(box.size.width / 2, box.size.height / 2);
    final dx = _pointerPos.dx - center.dx;
    final dy = center.dy - _pointerPos.dy; // Flip Y coordinate

    if (dx.abs() < box.size.width / 2 && dy.abs() < box.size.height / 2) {
      // Over the button, settle on corner diagonal sways
      final nx = dx / (box.size.width / 2);
      final ny = dy / (box.size.height / 2);
      return math.atan2(2 / box.size.height, -2 / box.size.width) + nx * 0.3 + ny * 0.15;
    }

    return math.atan2(dy, dx);
  }

  void _onPointerMove(PointerEvent event) {
    if (widget.disabled) return;

    final box = context.findRenderObject() as RenderBox?;
    if (box == null) return;

    final localPos = box.globalToLocal(event.position);

    final double dx = math.max(0.0, math.max(-localPos.dx, localPos.dx - box.size.width));
    final double dy = math.max(0.0, math.max(-localPos.dy, localPos.dy - box.size.height));
    final double dist = math.sqrt(dx * dx + dy * dy);

    setState(() {
      _pointerPos = localPos;
      final double t = math.max(0.0, 1.0 - dist / math.max(widget.proximity, 1.0));
      _proximityBrightness = t * t * (3.0 - 2.0 * t); // Smoothstep fade
      _updateSteerAngle();
    });
  }

  void _onPointerExit() {
    setState(() {
      _pointerPos = Offset.zero;
      _proximityBrightness = widget.autoAnimate ? 1.0 : 0.0;
    });
  }

  @override
  void dispose() {
    _rotationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dpr = MediaQuery.of(context).devicePixelRatio;
    final Color tintedBackground = widget.tint.withOpacity(widget.tintOpacity);

    Widget btnBody = Container(
      decoration: BoxDecoration(
        color: tintedBackground,
        borderRadius: BorderRadius.circular(widget.radius),
      ),
      child: Center(
        child: DefaultTextStyle(
          style: TextStyle(
            color: widget.disabled ? widget.textColor.withOpacity(0.5) : widget.textColor,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
          child: widget.child,
        ),
      ),
    );

    if (_shader != null && !widget.disabled) {
      btnBody = CustomPaint(
        painter: SpecularPainter(
          shader: _shader!,
          angle: _angle,
          radius: widget.radius,
          lineColor: widget.lineColor,
          baseColor: widget.baseColor,
          intensity: widget.intensity * (widget.autoAnimate ? 1.0 : _proximityBrightness),
          shineSize: (widget.shineSize * math.pi) / 180.0,
          shineFade: (widget.shineFade * math.pi) / 180.0,
          thickness: widget.thickness,
          dpr: dpr,
        ),
        child: btnBody,
      );
    }

    return Listener(
      onPointerMove: _onPointerMove,
      onPointerHover: _onPointerMove,
      onPointerCancel: (_) => _onPointerExit(),
      child: MouseRegion(
        onExit: (_) => _onPointerExit(),
        cursor: widget.disabled ? SystemMouseCursors.basic : SystemMouseCursors.click,
        child: GestureDetector(
          onTap: widget.disabled ? null : widget.onPressed,
          child: AnimatedScale(
            scale: widget.disabled ? 1.0 : 1.0,
            duration: const Duration(milliseconds: 100),
            child: Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(widget.radius),
              ),
              child: btnBody,
            ),
          ),
        ),
      ),
    );
  }
}

class SpecularPainter extends CustomPainter {
  final ui.FragmentShader shader;
  final double angle;
  final double radius;
  final Color lineColor;
  final Color baseColor;
  final double intensity;
  final double shineSize;
  final double shineFade;
  final double thickness;
  final double dpr;

  SpecularPainter({
    required this.shader,
    required this.angle,
    required this.radius,
    required this.lineColor,
    required this.baseColor,
    required this.intensity,
    required this.shineSize,
    required this.shineFade,
    required this.thickness,
    required this.dpr,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final double centerWidth = size.width / 2.0;
    final double centerHeight = size.height / 2.0;

    // uCenter (indices 0, 1)
    shader.setFloat(0, centerWidth);
    shader.setFloat(1, centerHeight);

    // uHalfSize (indices 2, 3)
    shader.setFloat(2, centerWidth);
    shader.setFloat(3, centerHeight);

    // uRadius (index 4)
    shader.setFloat(4, math.min(radius, math.min(size.width, size.height) / 2.0));

    // uAngle (index 5)
    shader.setFloat(5, angle);

    // uPx (index 6)
    shader.setFloat(6, dpr);

    // uLineColor (indices 7, 8, 9)
    shader.setFloat(7, lineColor.red / 255.0);
    shader.setFloat(8, lineColor.green / 255.0);
    shader.setFloat(9, lineColor.blue / 255.0);

    // uBaseColor (indices 10, 11, 12)
    shader.setFloat(10, baseColor.red / 255.0);
    shader.setFloat(11, baseColor.green / 255.0);
    shader.setFloat(12, baseColor.blue / 255.0);

    // uIntensity (index 13)
    shader.setFloat(13, intensity);

    // uShineSize (index 14)
    shader.setFloat(14, shineSize);

    // uShineFade (index 15)
    shader.setFloat(15, shineFade);

    // uThickness (index 16)
    shader.setFloat(16, thickness * dpr);

    // uBaseWidth (index 17)
    shader.setFloat(17, dpr);

    final Paint paint = Paint()..shader = shader;
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), paint);
  }

  @override
  bool shouldRepaint(covariant SpecularPainter oldDelegate) => true;
}
