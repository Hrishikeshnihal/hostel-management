import 'dart:async';
import 'package:flutter/material.dart';
import '../models/student.dart';
import '../models/attendance.dart';
import '../utils/database_helper.dart';

class HostelProvider extends ChangeNotifier {
  List<Student> _students = [];
  List<Attendance> _currentAttendance = [];
  DateTime _selectedDate = DateTime.now();
  String _searchQuery = '';

  StreamSubscription<List<Student>>? _studentsSub;
  StreamSubscription<List<Attendance>>? _attendanceSub;

  List<Student> get students => _students;
  List<Attendance> get currentAttendance => _currentAttendance;
  DateTime get selectedDate => _selectedDate;
  String get searchQuery => _searchQuery;

  // Filtered list based on search query
  List<Student> get filteredStudents {
    if (_searchQuery.trim().isEmpty) return _students;
    final q = _searchQuery.toLowerCase();
    return _students.where((s) {
      return s.name.toLowerCase().contains(q) ||
          s.rollNumber.toLowerCase().contains(q) ||
          s.roomNumber.toLowerCase().contains(q);
    }).toList();
  }

  // Stats Calculations
  int get totalStudentsCount => _students.length;
  int get presentCount => _currentAttendance.where((a) => a.status == 'Present').length;
  int get absentCount => _currentAttendance.where((a) => a.status == 'Absent').length;
  int get leaveCount => _currentAttendance.where((a) => a.status == 'Leave').length;

  double get todayAttendanceRate {
    if (totalStudentsCount == 0) return 0.0;
    // (Present + Leave) counts towards attendance or just Present
    final activePresent = _currentAttendance.where((a) => a.status == 'Present').length;
    return (activePresent / totalStudentsCount) * 100;
  }

  HostelProvider() {
    _initStreams();
  }

  void _initStreams() {
    // Stream students in real-time
    _studentsSub = DatabaseHelper.streamStudents().listen((studentList) {
      _students = studentList;
      notifyListeners();
    });

    // Stream attendance for selected date
    _updateAttendanceSubscription();
  }

  void _updateAttendanceSubscription() {
    _attendanceSub?.cancel();
    _attendanceSub = DatabaseHelper.streamAttendanceForDate(_selectedDate).listen((attendanceList) {
      _currentAttendance = attendanceList;
      notifyListeners();
    });
  }

  // Update selected date and refresh attendance stream
  void setSelectedDate(DateTime date) {
    _selectedDate = date;
    _updateAttendanceSubscription();
    notifyListeners();
  }

  void updateSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  // Mark/Toggle attendance for a specific student locally
  Future<void> markAttendance(String studentId, String status) async {
    final student = _students.firstWhere((s) => s.id == studentId);
    final dateKey = DatabaseHelper.formatDateKey(_selectedDate);
    final recordId = "${studentId}_$dateKey";

    final record = Attendance(
      id: recordId,
      studentId: studentId,
      studentName: student.name,
      roomNumber: student.roomNumber,
      date: _selectedDate,
      status: status,
    );

    // Single write to Firestore (offline first cache takes care of instant update)
    await DatabaseHelper.saveAttendanceBatch([record]);
  }

  // Mark all students present at once
  Future<void> markAllPresent() async {
    final dateKey = DatabaseHelper.formatDateKey(_selectedDate);
    final List<Attendance> records = _students.map((student) {
      final recordId = "${student.id}_$dateKey";
      return Attendance(
        id: recordId,
        studentId: student.id,
        studentName: student.name,
        roomNumber: student.roomNumber,
        date: _selectedDate,
        status: 'Present',
      );
    }).toList();

    await DatabaseHelper.saveAttendanceBatch(records);
  }

  @override
  void dispose() {
    _studentsSub?.cancel();
    _attendanceSub?.cancel();
    super.dispose();
  }
}
