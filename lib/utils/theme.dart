import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Premium HSL Tailored Color Palette
  static const Color darkBg = Color(0xFF0C0C0E);
  static const Color darkCard = Color(0xFF141416);
  static const Color darkBorder = Color(0xFF232326);
  static const Color darkText = Color(0xFFE7E9EE);
  static const Color darkTextMuted = Color(0xFF8B93A1);

  static const Color lightBg = Color(0xFFF8FAFC);
  static const Color lightCard = Color(0xFFFFFFFF);
  static const Color lightBorder = Color(0xFFE2E8F0);
  static const Color lightText = Color(0xFF0F172A);
  static const Color lightTextMuted = Color(0xFF64748B);

  static const Color accentIndigo = Color(0xFF6366F1);
  static const Color accentGreen = Color(0xFF10B981);
  static const Color accentRed = Color(0xFFEF4444);
  static const Color accentOrange = Color(0xFFF59E0B);

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: darkBg,
      cardColor: darkCard,
      dividerColor: darkBorder,
      primaryColor: accentIndigo,
      colorScheme: const ColorScheme.dark(
        primary: accentIndigo,
        secondary: accentGreen,
        surface: darkCard,
        background: darkBg,
        error: accentRed,
      ),
      textTheme: GoogleFonts.outfitTextTheme(const TextTheme(
        bodyLarge: TextStyle(color: darkText),
        bodyMedium: TextStyle(color: darkTextMuted),
      )),
    );
  }

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: lightBg,
      cardColor: lightCard,
      dividerColor: lightBorder,
      primaryColor: accentIndigo,
      colorScheme: const ColorScheme.light(
        primary: accentIndigo,
        secondary: accentGreen,
        surface: lightCard,
        background: lightBg,
        error: accentRed,
      ),
      textTheme: GoogleFonts.outfitTextTheme(const TextTheme(
        bodyLarge: TextStyle(color: lightText),
        bodyMedium: TextStyle(color: lightTextMuted),
      )),
    );
  }
}
