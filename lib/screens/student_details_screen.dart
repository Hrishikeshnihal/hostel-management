import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/student.dart';
import '../models/attendance.dart';
import '../utils/database_helper.dart';

class StudentDetailsScreen extends StatelessWidget {
  final Student student;

  const StudentDetailsScreen({super.key, required this.student});

  final List<String> _avatars = const [
    '👤', '🎓', '🦁', '🦉', '🦊', '🐼', '🐨', '🐸'
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Student Profile'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
            onPressed: () => _confirmDelete(context),
          )
        ],
      ),
      body: StreamBuilder<List<Attendance>>(
        stream: DatabaseHelper.streamAttendanceForStudent(student.id),
        builder: (context, snapshot) {
          final history = snapshot.data ?? [];
          final totalDays = history.length;
          final presentDays = history.where((a) => a.status == 'Present').length;
          final absentDays = history.where((a) => a.status == 'Absent').length;
          final leaveDays = history.where((a) => a.status == 'Leave').length;

          final attendanceRate = totalDays == 0 ? 0.0 : (presentDays / totalDays) * 100;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header Info Card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: theme.cardColor,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: theme.dividerColor),
                  ),
                  child: Column(
                    children: [
                      Text(
                        _avatars[student.avatarIndex.clamp(0, _avatars.length - 1)],
                        style: const TextStyle(fontSize: 60),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        student.name,
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Room ${student.roomNumber} • ID: ${student.rollNumber}',
                        style: theme.textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 12),
                      GestureDetector(
                        onTap: () {
                          // Simple dialer launch fallback or visual popup
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Calling ${student.phoneNumber}...')),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: theme.primaryColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.phone_outlined, size: 16, color: theme.primaryColor),
                              const SizedBox(width: 8),
                              Text(
                                student.phoneNumber,
                                style: TextStyle(
                                  color: theme.primaryColor,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Stats row
                Text(
                  'Attendance Statistics',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _buildStatCard(
                        title: 'Presence Rate',
                        value: '${attendanceRate.toStringAsFixed(0)}%',
                        color: Colors.indigoAccent,
                        theme: theme,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildStatCard(
                        title: 'Present / Total',
                        value: '$presentDays / $totalDays',
                        color: Colors.green,
                        theme: theme,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _buildStatCard(
                        title: 'Absent Days',
                        value: '$absentDays',
                        color: Colors.redAccent,
                        theme: theme,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildStatCard(
                        title: 'Leave Days',
                        value: '$leaveDays',
                        color: Colors.orangeAccent,
                        theme: theme,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 32),

                // History Feed
                Text(
                  'Recent Logs',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                if (history.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: theme.cardColor.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Center(
                      child: Text('No attendance records logged yet.'),
                    ),
                  )
                else
                  ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: history.length,
                    itemBuilder: (context, index) {
                      final item = history[index];
                      Color badgeColor = Colors.grey;
                      if (item.status == 'Present') badgeColor = Colors.green;
                      if (item.status == 'Absent') badgeColor = Colors.redAccent;
                      if (item.status == 'Leave') badgeColor = Colors.orangeAccent;

                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                        borderOnForeground: true,
                        child: ListTile(
                          title: Text(DateFormat('EEEE, d MMM yyyy').format(item.date)),
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: badgeColor.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: badgeColor.withOpacity(0.5)),
                            ),
                            child: Text(
                              item.status,
                              style: TextStyle(
                                color: badgeColor,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildStatCard({
    required String title,
    required String value,
    required Color color,
    required ThemeData theme,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 12, color: Colors.grey),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Student?'),
        content: Text('Are you sure you want to delete ${student.name}? All their attendance logs will be permanently deleted.'),
        actions: [
          TextButton(
            child: const Text('Cancel'),
            onPressed: () => Navigator.pop(context),
          ),
          TextButton(
            child: const Text('Delete', style: TextStyle(color: Colors.redAccent)),
            onPressed: () async {
              Navigator.pop(context); // Close dialog
              await DatabaseHelper.deleteStudent(student.id);
              if (context.mounted) {
                Navigator.pop(context); // Back to registry list
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('${student.name} deleted successfully.'),
                    backgroundColor: Colors.redAccent,
                  ),
                );
              }
            },
          ),
        ],
      ),
    );
  }
}
