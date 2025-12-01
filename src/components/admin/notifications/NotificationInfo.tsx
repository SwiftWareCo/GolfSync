import { Card, CardHeader, CardContent, CardTitle } from "~/components/ui/card";

export function NotificationInfo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Notification System Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-500"></div>
          <div>
            <p className="font-medium">Automatic Booking Notifications</p>
            <p className="text-gray-600">
              Members receive notifications when bookings are made
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500"></div>
          <div>
            <p className="font-medium">Subscription Management</p>
            <p className="text-gray-600">
              Expired subscriptions are automatically cleaned up
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-yellow-500"></div>
          <div>
            <p className="font-medium">Member Control</p>
            <p className="text-gray-600">
              Members can enable/disable notifications in their account settings
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
