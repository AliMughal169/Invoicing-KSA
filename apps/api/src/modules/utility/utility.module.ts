import { Module } from "@nestjs/common";
import { TranslationService } from "./translation.service";
import { UtilityController } from "./utility.controller";

@Module({
  providers: [TranslationService],
  controllers: [UtilityController],
  exports: [TranslationService],
})
export class UtilityModule {}
