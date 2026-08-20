import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import '../models/student.dart';
import '../models/attendance.dart';

class DatabaseHelper {
  static bool useFirebase = false;

  static final List<Student> _localStudents = [];
  static final List<Attendance> _localAttendance = [];

  static final StreamController<List<Student>> _studentsController =
      StreamController<List<Student>>.broadcast();
  static final List<LocalStreamListener> _localListeners = [];

  static Future<void> initialize() async {
    try {
      // If Firebase is initialized correctly, use it
      FirebaseFirestore.instance.settings = const Settings(
        persistenceEnabled: true,
        cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
      );
      useFirebase = true;
      debugPrint("DatabaseHelper: Firebase Cloud Firestore initialized successfully.");
    } catch (e) {
      useFirebase = false;
      debugPrint("DatabaseHelper: Firebase missing or init failed: $e. Operating in Local persistent filesystem mode.");
      // Load local disk database files
      await _loadLocalData();
    }
  }

  // ===== LOCAL PERSISTENCE FILESYSTEM =====

  static Future<File> _getStudentsFile() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/students.json');
  }

  static Future<File> _getAttendanceFile() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/attendance.json');
  }

  static Future<void> _loadLocalData() async {
    try {
      final studentsFile = await _getStudentsFile();
      if (await studentsFile.exists()) {
        final content = await studentsFile.readAsString();
        final List<dynamic> jsonList = json.decode(content);
        _localStudents.clear();
        _localStudents.addAll(jsonList.map((m) => Student.fromMap(m)).toList());
      } else {
        // Fallback preloads for test warden experience
        _injectMockData();
        await _saveLocalStudents();
      }

      final attendanceFile = await _getAttendanceFile();
      if (await attendanceFile.exists()) {
        final content = await attendanceFile.readAsString();
        final List<dynamic> jsonList = json.decode(content);
        _localAttendance.clear();
        _localAttendance.addAll(jsonList.map((m) => Attendance.fromMap(m)).toList());
      }
    } catch (e) {
      debugPrint("DatabaseHelper: Error loading local persistent data: $e");
    }
  }

  static Future<void> _saveLocalStudents() async {
    try {
      final file = await _getStudentsFile();
      final list = _localStudents.map((s) => s.toMap()).toList();
      await file.writeAsString(json.encode(list));
    } catch (e) {
      debugPrint("DatabaseHelper: Error writing local students: $e");
    }
  }

  static Future<void> _saveLocalAttendance() async {
    try {
      final file = await _getAttendanceFile();
      final list = _localAttendance.map((a) => a.toMap()).toList();
      await file.writeAsString(json.encode(list));
    } catch (e) {
      debugPrint("DatabaseHelper: Error writing local attendance: $e");
    }
  }

  static void _injectMockData() {
    _localStudents.addAll([
      Student(
        id: "FY-1021",
        name: "Aryan Mhapralkar",
        rollNumber: "FY-1021",
        roomNumber: "101",
        phoneNumber: "+91 98765 43210",
        avatarIndex: 2,
        createdAt: DateTime.now(),
      ),
      Student(
        id: "FY-1025",
        name: "Akshara Choudhari",
        rollNumber: "FY-1025",
        roomNumber: "102",
        phoneNumber: "+91 77963 07973",
        avatarIndex: 4,
        createdAt: DateTime.now(),
      ),
      Student(
        id: "FY-1033",
        name: "Sumit Khond",
        rollNumber: "FY-1033",
        roomNumber: "101",
        phoneNumber: "+91 88990 12345",
        avatarIndex: 6,
        createdAt: DateTime.now(),
      ),
    ]);
    _studentsController.add(List.from(_localStudents));
  }

  // ===== STUDENT OPERATIONS =====

  static Stream<List<Student>> streamStudents() {
    if (useFirebase) {
      return FirebaseFirestore.instance.collection('students').snapshots().map((snapshot) {
        return snapshot.docs.map((doc) => Student.fromMap(doc.data())).toList();
      });
    } else {
      // Local fallback stream
      Timer.run(() => _studentsController.add(List.from(_localStudents)));
      return _studentsController.stream;
    }
  }

  static Future<void> addStudent(Student student) async {
    if (useFirebase) {
      await FirebaseFirestore.instance.collection('students').doc(student.id).set(student.toMap());
    } else {
      _localStudents.add(student);
      await _saveLocalStudents();
      _studentsController.add(List.from(_localStudents));
    }
  }

  static Future<void> updateStudent(Student student) async {
    if (useFirebase) {
      await FirebaseFirestore.instance.collection('students').doc(student.id).update(student.toMap());
    } else {
      final index = _localStudents.indexWhere((s) => s.id == student.id);
      if (index != -1) {
        _localStudents[index] = student;
        await _saveLocalStudents();
        _studentsController.add(List.from(_localStudents));
      }
    }
  }

  static Future<void> deleteStudent(String studentId) async {
    if (useFirebase) {
      WriteBatch batch = FirebaseFirestore.instance.batch();
      batch.delete(FirebaseFirestore.instance.collection('students').doc(studentId));

      final attendanceDocs = await FirebaseFirestore.instance
          .collection('attendance')
          .where('studentId', isEqualTo: studentId)
          .get();

      for (var doc in attendanceDocs.docs) {
        batch.delete(doc.reference);
      }
      await batch.commit();
    } else {
      _localStudents.removeWhere((s) => s.id == studentId);
      _localAttendance.removeWhere((a) => a.studentId == studentId);
      await _saveLocalStudents();
      await _saveLocalAttendance();
      _studentsController.add(List.from(_localStudents));
      for (var listener in _localListeners) {
        final filtered = _localAttendance.where((a) => a.dateKey == listener.dateKey).toList();
        listener.onUpdate(filtered);
      }
    }
  }

  // ===== ATTENDANCE OPERATIONS =====

  static String formatDateKey(DateTime date) {
    return "${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}";
  }

  static Stream<List<Attendance>> streamAttendanceForDate(DateTime date) {
    final dateKey = formatDateKey(date);
    if (useFirebase) {
      return FirebaseFirestore.instance
          .collection('attendance')
          .where('dateKey', isEqualTo: dateKey)
          .snapshots()
          .map((snapshot) {
        return snapshot.docs.map((doc) => Attendance.fromMap(doc.data())).toList();
      });
    } else {
      late StreamController<List<Attendance>> controller;
      final listener = LocalStreamListener(
        dateKey: dateKey,
        onUpdate: (data) {
          if (!controller.isClosed) {
            controller.add(data);
          }
        },
      );

      controller = StreamController<List<Attendance>>(
        onListen: () {
          _localListeners.add(listener);
          final filtered = _localAttendance.where((a) => a.dateKey == dateKey).toList();
          controller.add(filtered);
        },
        onCancel: () {
          _localListeners.remove(listener);
          controller.close();
        },
      );

      return controller.stream;
    }
  }

  static Future<void> saveAttendanceBatch(List<Attendance> records) async {
    if (useFirebase) {
      WriteBatch batch = FirebaseFirestore.instance.batch();
      for (var record in records) {
        final docRef = FirebaseFirestore.instance.collection('attendance').doc(record.id);
        batch.set(docRef, record.toMap());
      }
      await batch.commit();
    } else {
      for (var record in records) {
        final idx = _localAttendance.indexWhere((a) => a.id == record.id);
        if (idx != -1) {
          _localAttendance[idx] = record;
        } else {
          _localAttendance.add(record);
        }
      }
      await _saveLocalAttendance();
      for (var listener in _localListeners) {
        final filtered = _localAttendance.where((a) => a.dateKey == listener.dateKey).toList();
        listener.onUpdate(filtered);
      }
    }
  }

  static Stream<List<Attendance>> streamAttendanceForStudent(String studentId) {
    if (useFirebase) {
      return FirebaseFirestore.instance
          .collection('attendance')
          .where('studentId', isEqualTo: studentId)
          .snapshots()
          .map((snapshot) {
        return snapshot.docs.map((doc) => Attendance.fromMap(doc.data())).toList();
      });
    } else {
      // Local history
      final StreamController<List<Attendance>> controller = StreamController<List<Attendance>>();
      final filtered = _localAttendance.where((a) => a.studentId == studentId).toList();
      Timer.run(() {
        controller.add(filtered);
        controller.close();
      });
      return controller.stream;
    }
  }
}

class LocalStreamListener {
  final String dateKey;
  final void Function(List<Attendance>) onUpdate;

  LocalStreamListener({required this.dateKey, required this.onUpdate});
}
