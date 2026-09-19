import { createServices } from "@/lib/services/factory";
import { requireProviderAdmin } from "@/lib/api/provider-admin";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import type { PromptSuggestion } from "@/types/domain/prompt-suggestion";

function messageFor(suggestion: PromptSuggestion): string {
  switch (suggestion.status) {
    case "published":
      return "בדיקות הרגרסיה עברו בהצלחה — הפרומפט החדש פורסם לסוכן החי.";
    case "approved":
      return "סומן כמאושר להמשך טיפול ידני — התיקון הזה אינו שינוי פרומפט, ולכן לא הורצה בדיקת רגרסיה ולא בוצע פרסום.";
    case "failed_regression":
      return "בדיקת רגרסיה אחת או יותר נכשלה. הפרומפט לא פורסם; ראה regressionResult.";
    case "pending":
      return "לא ניתן היה לקבוע בביטחון הצלחה או כישלון מתגובת ElevenLabs. הפרומפט לא פורסם; ראה regressionResult לתגובה הגולמית.";
    default:
      return "";
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = createRequestId();

  try {
    const services = await createServices();
    const { user } = await requireProviderAdmin(services.auth);
    const { id } = await params;
    const result = await services.promptSuggestion.approve(user.id, id);
    if (!result.ok) return handleRouteError(result.error, requestId);

    return jsonSuccess(
      {
        suggestion: result.value,
        published: result.value.status === "published",
        message: messageFor(result.value),
      },
      200,
      requestId,
    );
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
