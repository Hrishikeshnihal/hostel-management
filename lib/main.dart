import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'providers/hostel_provider.dart';
import 'screens/home_screen.dart';
import 'utils/database_helper.dart';
import 'utils/theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load Firebase if available, otherwise catch and trigger the DatabaseHelper local mode
  try {
    await Firebase.initializeApp();
  } catch (e) {
    debugPrint("Firebase not found or not initialized: $e. Operating in Local Memory mode.");
  }

  await DatabaseHelper.initialize();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => HostelProvider(),
      child: MaterialApp(
        title: 'Wingmate Warden',
        themeMode: ThemeMode.dark, // Keep dynamic dark mode theme by default
        darkTheme: AppTheme.darkTheme,
        theme: AppTheme.lightTheme,
        home: const HomeScreen(),
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}
