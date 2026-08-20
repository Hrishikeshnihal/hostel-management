import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/hostel_provider.dart';
import '../widgets/morph_slider.dart';
import '../models/attendance.dart';
import 'student_list_screen.dart';
import 'calendar_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final List<Widget> _tabs = [
    const _DashboardTab(),
    const StudentListScreen(),
    const CalendarScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: _tabs[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        backgroundColor: theme.cardColor,
        selectedItemColor: theme.primaryColor,
        unselectedItemColor: Colors.grey,
        showUnselectedLabels: true,
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.people_outline),
            activeIcon: Icon(Icons.people),
            label: 'Registry',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.calendar_today_outlined),
            activeIcon: Icon(Icons.calendar_today),
            label: 'Calendar',
          ),
        ],
      ),
    );
  }
}

class _DashboardTab extends StatelessWidget {
  const _DashboardTab();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final provider = Provider.of<HostelProvider>(context);
    final students = provider.students;
    final attendance = provider.currentAttendance;

    // Morph Slider Local Demo Items
    final List<MorphSliderItem> sliderItems = [
      MorphSliderItem(
        imagePath: 'assets/images/slide1.png', // Solid fallbacks will be auto-generated
        caption: 'Wingmate: Smart Hostel Attendance',
      ),
      MorphSliderItem(
        imagePath: 'assets/images/slide2.png',
        caption: 'Offline-First Real-Time Caching',
      ),
      MorphSliderItem(
        imagePath: 'assets/images/slide3.png',
        caption: 'Safe Cloud Backups & Zero Data Loss',
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Wingmate Warden',
          style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all, color: Colors.green),
            tooltip: 'Mark All Present',
            onPressed: () => _confirmMarkAllPresent(context, provider),
          )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Morph Slider UI
            const SizedBox(height: 10),
            MorphSlider(items: sliderItems, transitionMode: 0),
            const SizedBox(height: 24),

            // Today's Stats Card Grid
            Text(
              "Today's Overview",
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            _buildStatsGrid(context, provider),
            const SizedBox(height: 28),

            // Daily Attendance Checklist
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "Daily Attendance Checklist",
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  "${attendance.length}/${students.length} Marked",
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
            const SizedBox(height: 12),

            if (students.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  color: theme.cardColor,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: theme.dividerColor),
                ),
                child: const Center(
                  child: Text(
                    'No students registered. Go to Registry tab to add students.',
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: students.length,
                itemBuilder: (context, index) {
                  final student = students[index];
                  // Find if student attendance record exists for today
                  final attRecord = attendance.firstWhere(
                    (a) => a.studentId == student.id,
                    orElse: () => Attendance(
                      id: '',
                      studentId: student.id,
                      studentName: student.name,
                      roomNumber: student.roomNumber,
                      date: DateTime.now(),
                      status: 'Unmarked',
                    ),
                  );

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: theme.cardColor,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: theme.dividerColor),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                student.name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Room ${student.roomNumber} • ID: ${student.rollNumber}',
                                style: const TextStyle(fontSize: 12, color: Colors.grey),
                              ),
                            ],
                          ),
                        ),
                        // State toggles
                        Row(
                          children: [
                            _buildToggleCircle(
                              label: 'P',
                              isSelected: attRecord.status == 'Present',
                              activeColor: Colors.green,
                              onTap: () => provider.markAttendance(student.id, 'Present'),
                            ),
                            const SizedBox(width: 8),
                            _buildToggleCircle(
                              label: 'A',
                              isSelected: attRecord.status == 'Absent',
                              activeColor: Colors.redAccent,
                              onTap: () => provider.markAttendance(student.id, 'Absent'),
                            ),
                            const SizedBox(width: 8),
                            _buildToggleCircle(
                              label: 'L',
                              isSelected: attRecord.status == 'Leave',
                              activeColor: Colors.orangeAccent,
                              onTap: () => provider.markAttendance(student.id, 'Leave'),
                            ),
                          ],
                        )
                      ],
                    ),
                  );
                },
              ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsGrid(BuildContext context, HostelProvider provider) {
    final theme = Theme.of(context);
    final rate = provider.todayAttendanceRate;

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.6,
      children: [
        _buildMiniStatCard(
          'Total Students',
          '${provider.totalStudentsCount}',
          Colors.indigoAccent,
          theme,
        ),
        _buildMiniStatCard(
          'Attendance Rate',
          '${rate.toStringAsFixed(0)}%',
          Colors.green,
          theme,
        ),
        _buildMiniStatCard(
          'Present Today',
          '${provider.presentCount}',
          Colors.green,
          theme,
        ),
        _buildMiniStatCard(
          'Absent Today',
          '${provider.absentCount}',
          Colors.redAccent,
          theme,
        ),
      ],
    );
  }

  Widget _buildMiniStatCard(String title, String value, Color accentColor, ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(title, style: const TextStyle(fontSize: 12, color: Colors.grey)),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: accentColor),
          ),
        ],
      ),
    );
  }

  Widget _buildToggleCircle({
    required String label,
    required bool isSelected,
    required Color activeColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: isSelected ? activeColor : Colors.transparent,
          shape: BoxShape.circle,
          border: Border.all(
            color: isSelected ? activeColor : Colors.grey.shade700,
            width: 1.5,
          ),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              color: isSelected ? Colors.black : Colors.grey,
              fontWeight: FontWeight.bold,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }

  void _confirmMarkAllPresent(BuildContext context, HostelProvider provider) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Mark All Present?'),
        content: const Text('Are you sure you want to mark all registered students as present for today?'),
        actions: [
          TextButton(
            child: const Text('Cancel'),
            onPressed: () => Navigator.pop(context),
          ),
          TextButton(
            child: const Text('Confirm', style: TextStyle(color: Colors.green)),
            onPressed: () async {
              Navigator.pop(context);
              await provider.markAllPresent();
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('All students marked present!'),
                    backgroundColor: Colors.green,
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
