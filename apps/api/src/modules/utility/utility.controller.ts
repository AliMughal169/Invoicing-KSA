import { Controller, Post, Body } from "@nestjs/common";
import { TranslationService } from "./translation.service";

@Controller("utility")
export class UtilityController {
  constructor(private readonly translation: TranslationService) {}

  @Post("translate")
  translate(@Body() body: { text: string; from: string; to: string }) {
    const translatedText = this.translation.translateEnToAr(body.text);
    return { translatedText };
  }
}
