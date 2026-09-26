import { IsNotEmpty } from 'class-validator';

export class CreateTodoDto {
  @IsNotEmpty({ message: 'Tieu de khong duoc de trong' })
  title: string;
  completed?: boolean;
}
