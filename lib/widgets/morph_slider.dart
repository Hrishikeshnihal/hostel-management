import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class MorphSliderItem {
  final String imagePath; // Asset path or url
  final String caption;

  MorphSliderItem({required this.imagePath, required this.caption});
}

class MorphSlider extends StatefulWidget {
  final List<MorphSliderItem> items;
  final double intensity;
  final double scale;
  final double aberration;
  final double drift;
  final int transitionMode; // 0: melt, 1: ripple, 2: shear, 3: swirl
  final bool autoplay;
  final int autoplayDelaySeconds;

  const MorphSlider({
    super.key,
    required this.items,
    this.intensity = 0.55,
    this.scale = 2.4,
    this.aberration = 0.35,
    this.drift = 0.3,
    this.transitionMode = 0,
    this.autoplay = true,
    this.autoplayDelaySeconds = 4,
  });

  @override
  State<MorphSlider> createState() => _MorphSliderState();
}

class _MorphSliderState extends State<MorphSlider> with TickerProviderStateMixin {
  ui.FragmentShader? _shader;
  ui.Image? _currentTexture;
  ui.Image? _nextTexture;

  int _currentIndex = 0;
  int _nextIndex = 0;

  late AnimationController _progressController;
  late AnimationController _driftController;
  Timer? _autoplayTimer;
  Offset _pointerOffset = const Offset(0.5, 0.5);

  final Map<String, ui.Image> _imageCache = {};

  @override
  void initState() {
    super.initState();
    _progressController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );

    _driftController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    )..repeat();

    _loadShader();
    _loadInitialTextures();
    _startAutoplay();
  }

  Future<void> _loadShader() async {
    try {
      final program = await ui.FragmentProgram.fromAsset('assets/shaders/morph.frag');
      setState(() {
        _shader = program.fragmentShader();
      });
    } catch (e) {
      debugPrint("Error loading morph shader: $e");
    }
  }

  Future<ui.Image> _getImageTexture(String path, Color placeholderColor) async {
    if (_imageCache.containsKey(path)) return _imageCache[path]!;

    try {
      final data = await rootBundle.load(path);
      final codec = await ui.instantiateImageCodec(data.buffer.asUint8List());
      final frame = await codec.getNextFrame();
      _imageCache[path] = frame.image;
      return frame.image;
    } catch (e) {
      // Fallback solid color texture generator
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder);
      canvas.drawRect(
        const Rect.fromLTWH(0, 0, 400, 300),
        Paint()..color = placeholderColor,
      );
      final picture = recorder.endRecording();
      final img = await picture.toImage(400, 300);
      _imageCache[path] = img;
      return img;
    }
  }

  Future<void> _loadInitialTextures() async {
    if (widget.items.isEmpty) return;
    final currentImg = await _getImageTexture(
      widget.items[_currentIndex].imagePath,
      Colors.indigo.shade900,
    );
    setState(() {
      _currentTexture = currentImg;
      _nextTexture = currentImg;
    });
  }

  void _startAutoplay() {
    _autoplayTimer?.cancel();
    if (!widget.autoplay) return;

    _autoplayTimer = Timer.periodic(Duration(seconds: widget.autoplayDelaySeconds), (timer) {
      _nextSlide();
    });
  }

  Future<void> _transitionTo(int nextIndex) async {
    if (_progressController.isAnimating || widget.items.length < 2) return;

    _autoplayTimer?.cancel();
    setState(() {
      _nextIndex = nextIndex;
    });

    final nextImg = await _getImageTexture(
      widget.items[nextIndex].imagePath,
      Colors.indigo.shade900,
    );

    setState(() {
      _nextTexture = nextImg;
    });

    await _progressController.forward(from: 0.0);

    setState(() {
      _currentIndex = nextIndex;
      _currentTexture = nextImg;
    });
    _progressController.value = 0.0;
    _startAutoplay();
  }

  void _nextSlide() {
    final int nextIdx = (_currentIndex + 1) % widget.items.length;
    _transitionTo(nextIdx);
  }

  void _prevSlide() {
    final int prevIdx = (_currentIndex - 1 + widget.items.length) % widget.items.length;
    _transitionTo(prevIdx);
  }

  @override
  void dispose() {
    _progressController.dispose();
    _driftController.dispose();
    _autoplayTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_shader == null || _currentTexture == null || _nextTexture == null) {
      return Container(
        height: 250,
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Center(
          child: CircularProgressIndicator(color: Colors.indigoAccent),
        ),
      );
    }

    return Container(
      height: 250,
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Colors.black26,
            blurRadius: 10,
            offset: Offset(0, 4),
          )
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Shader Stage Canvas
          GestureDetector(
            onPanUpdate: (details) {
              final box = context.findRenderObject() as RenderBox?;
              if (box != null) {
                final localPos = box.globalToLocal(details.globalPosition);
                setState(() {
                  _pointerOffset = Offset(
                    (localPos.dx / box.size.width).clamp(0.0, 1.0),
                    (localPos.dy / box.size.height).clamp(0.0, 1.0),
                  );
                });
              }
            },
            child: AnimatedBuilder(
              animation: Listenable.merge([_progressController, _driftController]),
              builder: (context, _) {
                return CustomPaint(
                  size: Size.infinite,
                  painter: MorphShaderPainter(
                    shader: _shader!,
                    progress: _progressController.value,
                    dir: _nextIndex >= _currentIndex ? 1.0 : -1.0,
                    mode: widget.transitionMode.toDouble(),
                    intensity: widget.intensity,
                    scale: widget.scale,
                    aberration: widget.aberration,
                    drift: widget.drift,
                    time: _driftController.value * 2 * math.pi,
                    reduce: 0.0,
                    pointer: _pointerOffset,
                    overlay: Colors.black,
                    textureCurrent: _currentTexture!,
                    textureNext: _nextTexture!,
                  ),
                );
              },
            ),
          ),

          // Caption Layer
          Positioned(
            left: 16,
            bottom: 16,
            right: 16,
            child: IgnorePointer(
              child: AnimatedBuilder(
                animation: _progressController,
                builder: (context, _) {
                  final activeCaption = _progressController.value < 0.5
                      ? widget.items[_currentIndex].caption
                      : widget.items[_nextIndex].caption;
                  final opacity = (0.5 - (_progressController.value - 0.5).abs()) * 2.0;

                  return Opacity(
                    opacity: opacity.clamp(0.1, 1.0),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.42),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        activeCaption,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),

          // Arrows
          Positioned(
            left: 10,
            top: 0,
            bottom: 0,
            child: Center(
              child: _ArrowButton(icon: Icons.chevron_left, onPressed: _prevSlide),
            ),
          ),
          Positioned(
            right: 10,
            top: 0,
            bottom: 0,
            child: Center(
              child: _ArrowButton(icon: Icons.chevron_right, onPressed: _nextSlide),
            ),
          ),

          // Indicators
          Positioned(
            bottom: 16,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(widget.items.length, (index) {
                final isActive = index == _currentIndex;
                return GestureDetector(
                  onTap: () => _transitionTo(index),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: isActive ? 22 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: isActive ? Colors.white : Colors.white54,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                );
              }),
            ),
          )
        ],
      ),
    );
  }
}

class MorphShaderPainter extends CustomPainter {
  final ui.FragmentShader shader;
  final double progress;
  final double dir;
  final double mode;
  final double intensity;
  final double scale;
  final double aberration;
  final double drift;
  final double time;
  final double reduce;
  final Offset pointer;
  final Color overlay;
  final ui.Image textureCurrent;
  final ui.Image textureNext;

  MorphShaderPainter({
    required this.shader,
    required this.progress,
    required this.dir,
    required this.mode,
    required this.intensity,
    required this.scale,
    required this.aberration,
    required this.drift,
    required this.time,
    required this.reduce,
    required this.pointer,
    required this.overlay,
    required this.textureCurrent,
    required this.textureNext,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // Set shader uniforms exactly in order of declaration
    shader.setFloat(0, size.width);
    shader.setFloat(1, size.height);
    shader.setFloat(2, progress);
    shader.setFloat(3, dir);
    shader.setFloat(4, mode);
    shader.setFloat(5, intensity);
    shader.setFloat(6, scale);
    shader.setFloat(7, aberration);
    shader.setFloat(8, drift);
    shader.setFloat(9, time);
    shader.setFloat(10, reduce);
    shader.setFloat(11, pointer.dx);
    shader.setFloat(12, pointer.dy);
    shader.setFloat(13, overlay.red / 255.0);
    shader.setFloat(14, overlay.green / 255.0);
    shader.setFloat(15, overlay.blue / 255.0);

    shader.setImageSampler(0, textureCurrent);
    shader.setImageSampler(1, textureNext);

    final Paint paint = Paint()..shader = shader;
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), paint);
  }

  @override
  bool shouldRepaint(covariant MorphShaderPainter oldDelegate) => true;
}

class _ArrowButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onPressed;

  const _ArrowButton({required this.icon, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.black38,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white24),
        ),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    );
  }
}
