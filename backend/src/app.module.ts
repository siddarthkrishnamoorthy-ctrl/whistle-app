import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { SportsModule } from "./sports/sports.module";
import { CentersModule } from "./centers/centers.module";
import { StaffModule } from "./staff/staff.module";
import { PlansModule } from "./plans/plans.module";
import { ClassesModule } from "./classes/classes.module";
import { ScheduleModule } from "./schedule/schedule.module";
import { DrillsModule } from "./drills/drills.module";
import { SemestersModule } from "./semesters/semesters.module";
import { LessonPlansModule } from "./lesson-plans/lesson-plans.module";
import { UploadsModule } from "./uploads/uploads.module";
import { EnquiriesModule } from "./enquiries/enquiries.module";
import { ClientsModule } from "./clients/clients.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { RenewalsModule } from "./renewals/renewals.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { SettingsModule } from "./settings/settings.module";
import { CommunicationModule } from "./communication/communication.module";
import { ReportsModule } from "./reports/reports.module";
import { RatingModule } from "./rating/rating.module";
import { InterschoolModule } from "./interschool/interschool.module";
import { ScoringModule } from "./scoring/scoring.module";
import { GradesModule } from "./grades/grades.module";
import { TimetablesModule } from "./timetables/timetables.module";
import { CurriculumModule } from "./curriculum/curriculum.module";
import { PlatformBillingModule } from "./platform-billing/platform-billing.module";
import { AssessmentsModule } from "./assessments/assessments.module";
import { JobsModule } from "./jobs/jobs.module";
import { SchoolsModule } from "./schools/schools.module";
import { TournamentsModule } from "./tournaments/tournaments.module";
import { ChessModule } from "./chess/chess.module";
import { PeriodicAssessmentsModule } from "./periodic-assessments/periodic-assessments.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    SportsModule,
    CentersModule,
    StaffModule,
    PlansModule,
    ClassesModule,
    ScheduleModule,
    DrillsModule,
    SemestersModule,
    LessonPlansModule,
    UploadsModule,
    EnquiriesModule,
    ClientsModule,
    InvoicesModule,
    RenewalsModule,
    AttendanceModule,
    SettingsModule,
    CommunicationModule,
    ReportsModule,
    RatingModule,
    InterschoolModule,
    ScoringModule,
    GradesModule,
    TimetablesModule,
    CurriculumModule,
    PlatformBillingModule,
    AssessmentsModule,
    JobsModule,
    SchoolsModule,
    TournamentsModule,
    ChessModule,
    PeriodicAssessmentsModule,
  ],
})
export class AppModule {}
