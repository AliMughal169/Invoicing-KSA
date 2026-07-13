import { Controller, Get, Post, Body, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Res, Query, Delete, Patch } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { existsSync, mkdirSync } from "fs";
import { Response } from "express";
import { JwtAuthGuard } from "../../iam/auth/jwt-auth.guard";
import { SettingsService } from "./settings.service";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  get() {
    return this.settingsService.getSettings();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  update(@Body() b: {
    companyNameEn?: string;
    companyNameAr?: string;
    crNumber?: string;
    vatNumber?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    companyLogoUrl?: string;
    letterheadUrl?: string;
    topMargin?: number;
    bottomMargin?: number;
    printOnLetterhead?: boolean;
  }) {
    return this.settingsService.updateSettings(b);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("letterhead")
  deleteLetterhead() {
    return this.settingsService.deleteLetterhead();
  }

  @UseGuards(JwtAuthGuard)
  @Get("custom-fields")
  listCustomFields(@Query("entityType") entityType?: string) {
    return this.settingsService.listCustomFieldDefinitions(entityType);
  }

  @UseGuards(JwtAuthGuard)
  @Post("custom-fields")
  createCustomField(@Body() b: {
    entityType: string;
    fieldKey: string;
    fieldLabel: string;
    fieldType: string;
    isRequired: boolean;
  }) {
    return this.settingsService.createCustomFieldDefinition(b);
  }

  @UseGuards(JwtAuthGuard)
  @Post("custom-fields/:id/delete")
  deleteCustomField(@Param("id") id: string) {
    return this.settingsService.deleteCustomFieldDefinition(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = "./uploads";
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }
          cb(null, dir);
        },
        filename: (req: any, file, cb) => {
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|pdf|doc|docx|xls|xlsx|txt|csv|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)$/) &&
            !file.originalname.match(/\.(jpg|jpeg|png|pdf|doc|docx|xls|xlsx|txt|csv)$/i)) {
          return cb(new BadRequestException("Only images, PDFs, and common document files are allowed!"), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadFile(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException("No file uploaded");
    const url = `/api/settings/uploads/${file.filename}`;
    return { url };
  }

  @Get("uploads/:filename")
  serveFile(@Param("filename") filename: string, @Res() res: Response) {
    const filePath = join(process.cwd(), "uploads", filename);
    if (!existsSync(filePath)) {
      return res.status(404).send("File not found");
    }
    return res.sendFile(filePath);
  }

  @UseGuards(JwtAuthGuard)
  @Get("note-templates")
  listNoteTemplates() {
    return this.settingsService.listNoteTemplates();
  }

  @UseGuards(JwtAuthGuard)
  @Get("note-templates/:id")
  getNoteTemplate(@Param("id") id: string) {
    return this.settingsService.getNoteTemplate(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("note-templates")
  createNoteTemplate(@Body() b: { title: string; content: string; isDefault?: boolean }) {
    return this.settingsService.createNoteTemplate(b);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("note-templates/:id")
  updateNoteTemplate(@Param("id") id: string, @Body() b: { title?: string; content?: string; isDefault?: boolean }) {
    return this.settingsService.updateNoteTemplate(id, b);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("note-templates/:id")
  deleteNoteTemplate(@Param("id") id: string) {
    return this.settingsService.deleteNoteTemplate(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("note-templates/:id/default")
  setDefaultNoteTemplate(@Param("id") id: string) {
    return this.settingsService.setDefaultNoteTemplate(id);
  }
}
