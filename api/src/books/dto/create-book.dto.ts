import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, IsUUID, Min } from 'class-validator';

export class CreateBookDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  author!: string;

  @IsString()
  @IsNotEmpty()
  isbn!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalCopies!: number;

  @IsString()
  @IsUUID()
  genreId!: string;
}
