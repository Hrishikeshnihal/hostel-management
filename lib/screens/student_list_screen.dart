import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/hostel_provider.dart';
import 'add_student_screen.dart';
import 'student_details_screen.dart';

class StudentListScreen extends StatelessWidget {
  const StudentListScreen({super.key});

  final List<String> _avatars = const [
    '👤', '🎓', '🦁', '🦉', '🦊', '🐼', '🐨', '🐸'
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hostelProvider = Provider.of<HostelProvider>(context);
    final students = hostelProvider.filteredStudents;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Student Registry'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const AddStudentScreen()),
          );
        },
        label: const Text('Add Student'),
        icon: const Icon(Icons.add),
        backgroundColor: theme.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          // Search Box
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 10.0),
            child: TextField(
              onChanged: (val) => hostelProvider.updateSearchQuery(val),
              decoration: InputDecoration(
                hintText: 'Search by name, room, or ID...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
              ),
            ),
          ),

          // Student Registry List
          Expanded(
            child: students.isEmpty
                ? const Center(
                    child: Text(
                      'No students found.',
                      style: TextStyle(color: Colors.grey),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: students.length,
                    itemBuilder: (context, index) {
                      final student = students[index];
                      final avatarEmoji = _avatars[student.avatarIndex.clamp(0, _avatars.length - 1)];

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: theme.cardColor,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: theme.dividerColor),
                        ),
                        child: ListTile(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => StudentDetailsScreen(student: student),
                              ),
                            );
                          },
                          leading: CircleAvatar(
                            backgroundColor: theme.scaffoldBackgroundColor,
                            radius: 25,
                            child: Text(
                              avatarEmoji,
                              style: const TextStyle(fontSize: 22),
                            ),
                          ),
                          title: Text(
                            student.name,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          subtitle: Text('Room ${student.roomNumber} • ID: ${student.rollNumber}'),
                          trailing: const Icon(Icons.chevron_right, color: Colors.grey),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
